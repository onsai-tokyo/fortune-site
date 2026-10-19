"""Offline catalog comparison. Output only allow-listed structural metadata."""
import argparse
import json
from pathlib import Path
from production_preflight import normalized, differences

TABLES = {'ai_book_grants', 'ai_book_credits', 'ai_books', 'partner_profiles', 'ai_book_questions', 'reading_saves'}
FIELDS = {'name', 'exists', 'kind', 'owner', 'rls', 'force_rls', 'columns', 'constraints', 'indexes', 'policies', 'acl', 'triggers'}
ROLES = {'PUBLIC', 'postgres', 'supabase_admin', 'anon', 'authenticated', 'service_role'}
PRIVILEGES = {'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'}


def safe_acl(acl):
    return normalized([{
        'grantor': entry['grantor'] if entry.get('grantor') in ROLES else 'OTHER_ROLE',
        'grantee': entry['grantee'] if entry.get('grantee') in ROLES else 'OTHER_ROLE',
        'privilege': entry['privilege'] if entry.get('privilege') in PRIVILEGES else 'OTHER_PRIVILEGE',
        'grantable': entry.get('grantable') is True,
    } for entry in acl])


def diagnose(baseline, production):
    result = {'status': 'B0_OFFLINE_DIAGNOSIS_ONLY', 'production_connection': 'NONE',
              'changed_sections': differences(baseline, production), 'table_differences': []}
    before = {t['name']: t for t in baseline['tables']}
    after = {t['name']: t for t in production['tables']}
    for name in sorted(TABLES):
        a, b = before.get(name, {}), after.get(name, {})
        changed = []
        for field in sorted(FIELDS):
            av, bv = a.get(field), b.get(field)
            if field == 'triggers':
                av = [t for t in av or [] if not t.get('internal')]
                bv = [t for t in bv or [] if not t.get('internal')]
            if normalized(av) != normalized(bv):
                changed.append(field)
        if changed:
            item = {'table': name, 'changed_fields': changed}
            if 'acl' in changed:
                item['rehearsal_acl'] = safe_acl(a.get('acl') or [])
                item['production_acl'] = safe_acl(b.get('acl') or [])
            result['table_differences'].append(item)
    # Do not emit function bodies, defaults, policy expressions, SQL, or rows.
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--encrypted-volume', type=Path, required=True)
    args = parser.parse_args()
    root = args.encrypted_volume.resolve()
    if not root.is_mount():
        raise ValueError('MOUNT_REQUIRED')
    candidates = []
    for summary in root.glob('attempt-*/summary.json'):
        value = json.loads(summary.read_text())
        if value.get('status') == 'SCOPED_REHEARSAL_OK' and value.get('server_stopped') is True:
            candidates.append(summary.parent / 'baseline.json')
    production = list(root.glob('production-preflight-*/production-baseline.json'))
    if len(candidates) != 1 or len(production) != 1:
        raise ValueError('CAPTURE_NOT_UNIQUE')
    print(json.dumps(diagnose(json.loads(candidates[0].read_text()), json.loads(production[0].read_text())), indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('{"status":"B0_OFFLINE_DIAGNOSIS_FAILED_STOP","production_connection":"NONE"}')
        raise SystemExit(1)
