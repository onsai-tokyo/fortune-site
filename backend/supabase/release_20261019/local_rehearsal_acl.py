"""Plan only narrowly observed excess grants in a LOCAL rehearsal database.

No connection or execution. Never alter production to match rehearsal.
"""
import copy
from production_preflight import normalized, differences

TABLES = {'ai_book_credits', 'ai_book_grants', 'ai_books', 'partner_profiles'}
PRIVILEGES = {'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER', 'MAINTAIN'}


def without_acl(table):
    table = copy.deepcopy(table)
    table.pop('acl', None)
    table['triggers'] = [t for t in table.get('triggers', []) if not t.get('internal')]
    return normalized(table)


def plan_local_acl(local, production):
    if set(differences(local, production)) - {'tables', 'extensions'}:
        raise ValueError('UNEXPECTED_BASELINE_DIFFERENCE')
    before = {t['name']: t for t in local['tables']}
    after = {t['name']: t for t in production['tables']}
    if set(before) != set(after):
        raise ValueError('TABLE_SCOPE_DIFFERENT')
    statements = []
    for name in sorted(before):
        a, b = before[name], after[name]
        if without_acl(a) != without_acl(b):
            raise ValueError('NON_ACL_TABLE_DIFFERENCE')
        av = {tuple(sorted(e.items())) for e in a.get('acl') or []}
        bv = {tuple(sorted(e.items())) for e in b.get('acl') or []}
        if av == bv:
            continue
        if name not in TABLES or bv - av:
            raise ValueError('ACL_CHANGE_OUTSIDE_APPROVED_PATTERN')
        excess = [dict(e) for e in av - bv]
        for entry in excess:
            if (set(entry) != {'grantor', 'grantee', 'privilege', 'grantable'} or
                entry['grantor'] != 'postgres' or entry['grantee'] not in {'anon', 'authenticated'} or
                entry['privilege'] not in PRIVILEGES or entry['grantable'] is not False):
                raise ValueError('ACL_CHANGE_OUTSIDE_APPROVED_PATTERN')
        roles = {e['grantee'] for e in excess}
        # REVOKE ALL must not remove privileges also present in production.
        if any(dict(e)['grantee'] in roles for e in bv):
            raise ValueError('PRODUCTION_GRANTS_MUST_BE_PRESERVED')
        for role in sorted(roles):
            statements.append(f'REVOKE ALL PRIVILEGES ON TABLE public."{name}" FROM "{role}";')
    return ("BEGIN;\nDO $local$ BEGIN IF inet_server_addr() IS NOT NULL THEN "
            "RAISE EXCEPTION 'LOCAL_UNIX_SOCKET_REQUIRED'; END IF; END $local$;\n" +
            '\n'.join(statements) + '\nCOMMIT;\n')
