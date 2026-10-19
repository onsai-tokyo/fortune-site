"""Owner-operated single approved migration. Never runs a batch or inverse SQL."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
from production_preflight import differences, select_matched_baseline

MIGRATION_SHA = 'e6c3f6c7052f15d3d3f148997a4a9eb1e11f5551df20d5f8ac09b489b2f74148'
QUESTION_MIGRATION = 'ai_book_questions_20261017.sql'
SAVES_MIGRATION = 'reading_saves_20261017.sql'
MIGRATIONS = {
    'web_book_credits_20261017.sql': (MIGRATION_SHA, 'WEB_CREDITS_APPLIED_VERIFIED',
                                    'web-credits', 1, 'public.ai_book_grants IN ACCESS EXCLUSIVE MODE'),
    QUESTION_MIGRATION: ('461a5245afc066d9915c80a1e9b12d8f09fdb2de71eebc655d096c03b7ef2d62',
                        'BOOK_QUESTIONS_APPLIED_VERIFIED', 'book-questions', 2,
                        'public.ai_books IN SHARE ROW EXCLUSIVE MODE'),
    SAVES_MIGRATION: ('d9948b4773d8ef773bf8b2759f0fefbe8f490d103cf7cbe6b181fefa16a55eee',
                     'READING_SAVES_APPLIED_VERIFIED', 'reading-saves', 3,
                     'public.partner_profiles IN SHARE ROW EXCLUSIVE MODE'),
}


def inner_sql(text, opening):
    lines = text.strip().splitlines()
    # preflight starts with comments; migration begins immediately with BEGIN.
    while lines and lines[0].lstrip().startswith('--'):
        lines.pop(0)
    if not lines or lines[0].strip().lower() != opening or lines[-1].strip().lower() != 'commit;':
        raise RuntimeError('TRANSACTION_ENVELOPE_UNEXPECTED')
    return '\n'.join(lines[1:-1]) + '\n'


def drift(before, after):
    changed = differences(before, after)
    if before['server_version_num'] != after['server_version_num']:
        changed.append('postgres_exact_version')
    return changed


def catalog_query(text):
    text = inner_sql(text, 'begin read only;')
    prefix, marker, query = text.partition('with wanted_functions')
    if not marker or any(line.strip() and not line.lower().startswith('set local ')
                         for line in prefix.splitlines()):
        raise RuntimeError('CATALOG_QUERY_FORMAT_STOP')
    return (marker + query).strip().removesuffix(';')


NORMALIZATION_SQL = r'''
CREATE FUNCTION pg_temp.fatelab_canonical(v jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog AS $normalize$
DECLARE result jsonb;
BEGIN
 IF jsonb_typeof(v)='object' THEN
  SELECT coalesce(jsonb_object_agg(key,pg_temp.fatelab_canonical(value)),'{}'::jsonb)
    INTO result FROM jsonb_each(v);
 ELSIF jsonb_typeof(v)='array' THEN
  SELECT coalesce(jsonb_agg(item ORDER BY item::text),'[]'::jsonb) INTO result
    FROM (SELECT pg_temp.fatelab_canonical(value) item FROM jsonb_array_elements(v)) a;
 ELSE result := v;
 END IF;
 RETURN result;
END $normalize$;
CREATE FUNCTION pg_temp.fatelab_comparable(s jsonb) RETURNS jsonb
LANGUAGE plpgsql SET search_path=pg_catalog AS $comparable$
DECLARE result jsonb; tables_value jsonb; extensions_value jsonb;
BEGIN
 SELECT coalesce(jsonb_agg(t || jsonb_build_object('triggers',
   (SELECT coalesce(jsonb_agg(g),'[]'::jsonb) FROM jsonb_array_elements(t->'triggers') g
      WHERE NOT (g->>'internal')::boolean))),'[]'::jsonb)
 INTO tables_value FROM jsonb_array_elements(s->'tables') t;
 SELECT coalesce(jsonb_agg(jsonb_build_object('name',e->'name','version',e->'version',
   'schema',e->'schema')),'[]'::jsonb)
 INTO extensions_value FROM jsonb_array_elements(s->'extensions') e;
 result := jsonb_build_object('format_version',s->'format_version',
  'server_version_num',s->'server_version_num','constraints',s->'constraints',
  'functions',s->'functions','tables',tables_value,'extensions',extensions_value,
  'foreign_keys_to_partial_scope',s->'foreign_keys_to_partial_scope');
 RETURN pg_temp.fatelab_canonical(result);
END $comparable$;
'''


def guard_sql(query, expected, code):
    if code not in ('PRE_APPLY_DRIFT_STOP', 'POST_APPLY_DIFFERENCE_ROLLBACK'):
        raise RuntimeError('GUARD_CODE_INVALID')
    literal = json.dumps(expected, ensure_ascii=True).replace("'", "''")
    return ("DO $fatelab_guard$ DECLARE actual jsonb; BEGIN actual := (" + query + ");\n"
            "IF pg_temp.fatelab_comparable(actual) IS DISTINCT FROM "
            "pg_temp.fatelab_comparable('" + literal + "'::jsonb) THEN "
            "RAISE EXCEPTION '" + code + "'; END IF; END $fatelab_guard$;\n")


def apply_transaction(command, env, output, baseline, expected, release,
                      migration_name='web_book_credits_20261017.sql'):
    if migration_name not in MIGRATIONS:
        raise RuntimeError('MIGRATION_NOT_APPROVED_STOP')
    sha, success, label, step, lock = MIGRATIONS[migration_name]
    migration = (release.parent / migration_name).read_bytes()
    if hashlib.sha256(migration).hexdigest() != sha:
        raise RuntimeError('MIGRATION_CHANGED_STOP')
    query = catalog_query((release / 'preflight.sql').read_text())
    body = inner_sql(migration.decode(), 'begin;')
    summary = {'status': 'NOT_STARTED', 'committed': None, 'migration': migration_name}
    # One static file, one transaction, no stdin/stdout handshake. All guards
    # run on the database BEFORE psql is allowed to COMMIT. Temp functions are
    # explicitly dropped, leaving no helper objects in a pooled connection.
    script = ("SET LOCAL standard_conforming_strings=on; SET LOCAL search_path=pg_catalog;\n"
              "SET LOCAL lock_timeout='5s'; SET LOCAL statement_timeout='30s';\n"
              "SET LOCAL idle_in_transaction_session_timeout='60s';\n"
              "CREATE TEMP TABLE fatelab_guard_init(id integer) ON COMMIT DROP;\n" + NORMALIZATION_SQL +
              'LOCK TABLE ' + lock + ';\n' +
              guard_sql(query, baseline, 'PRE_APPLY_DRIFT_STOP') + body +
              guard_sql(query, expected, 'POST_APPLY_DIFFERENCE_ROLLBACK') +
              "DROP FUNCTION pg_temp.fatelab_comparable(jsonb);\n"
              "DROP FUNCTION pg_temp.fatelab_canonical(jsonb);\n"
              "SELECT 'WEB_CREDITS_TRANSACTION_CHECKED';\n")
    path = output / ('private-guarded-' + label + '.sql')
    path.write_text(script)
    with (output / 'private-errors.log').open('wb') as errors, (output / 'private-output.log').open('wb') as stdout:
        try:
            result = subprocess.run(command + ['--single-transaction', '-f', str(path)], env=env,
                                    stdin=subprocess.DEVNULL, stdout=stdout, stderr=errors, timeout=180)
            if result.returncode == 0:
                summary.update(status=success, committed=True)
            else:
                summary['status'] = 'APPLY_OR_COMMIT_RESULT_UNKNOWN_STOP'
        except subprocess.TimeoutExpired:
            summary['status'] = 'APPLY_TIMEOUT_STATE_RECHECK_REQUIRED'
    if summary['committed'] is not True:
        raw = (output / 'private-errors.log').read_bytes()
        for code in ('PRE_APPLY_DRIFT_STOP', 'POST_APPLY_DIFFERENCE_ROLLBACK'):
            if ('ERROR:  ' + code).encode() in raw:
                summary.update(status=code, committed=False)
                break
    return summary


def main(migration_name='web_book_credits_20261017.sql'):
    if migration_name not in MIGRATIONS:
        raise RuntimeError('MIGRATION_NOT_APPROVED_STOP')
    _, _, label, step, _ = MIGRATIONS[migration_name]
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--encrypted-volume', type=Path, required=True)
    args = parser.parse_args()
    os.umask(0o077)
    root = args.encrypted_volume.resolve()
    if not root.is_mount():
        raise RuntimeError('ENCRYPTED_MOUNT_REQUIRED')
    baseline = select_matched_baseline(root)
    attempts = []
    for p in root.glob('attempt-matched-*/summary.json'):
        s = json.loads(p.read_text())
        if s.get('status') == 'SCOPED_REHEARSAL_OK' and s.get('server_stopped') is True:
            attempts.append(p.parent)
    if len(attempts) != 1:
        raise RuntimeError('MATCHED_ATTEMPT_NOT_UNIQUE')
    expected_path = attempts[0] / ('after-' + str(step) + '.json')
    if expected_path.is_symlink():
        raise RuntimeError('BASELINE_SYMLINK_STOP')
    expected = json.loads(expected_path.read_text())
    # A recent successful B0 is required, not inferred from the rehearsal.
    safe = json.loads((root / 'production-preflight.safe-summary.json').read_text())
    if safe.get('status') != 'B0_MATCH':
        raise RuntimeError('B0_MATCH_REQUIRED')
    if step > 1:
        for previous_name, (_, previous_success, previous_label, previous_step, _) in MIGRATIONS.items():
            if previous_step >= step:
                continue
            receipt = json.loads((root / (previous_label + '.safe-summary.json')).read_text())
            if (receipt.get('committed') is not True or receipt.get('status') != previous_success or
                    receipt.get('migration') != previous_name):
                raise RuntimeError('PRIOR_MIGRATION_SUCCESS_REQUIRED')
        previous_path = attempts[0] / ('after-' + str(step - 1) + '.json')
        if previous_path.is_symlink():
            raise RuntimeError('BASELINE_SYMLINK_STOP')
        baseline = json.loads(previous_path.read_text())
    output = Path(tempfile.mkdtemp(prefix='production-' + label + '-', dir=root))
    env = {k: os.environ[k] for k in ('PATH', 'LANG', 'TMPDIR', 'HOME') if k in os.environ}
    env.update(PGPASSWORD=os.environ.pop('PGPASSWORD'), PGPASSFILE='/dev/null',
               PGSSLMODE='verify-full', PGSSLROOTCERT=os.environ['PGSSLROOTCERT'],
               PGCONNECT_TIMEOUT='15', PGAPPNAME='fatelab-approved-' + label + '-only')
    command = ['/opt/homebrew/opt/libpq/bin/psql', '-X', '-qAt', '--no-password',
               '--host=aws-1-ap-northeast-1.pooler.supabase.com', '--port=5432',
               '--username=postgres.jarerymytxcsqvzduqub', '--dbname=postgres', '-v', 'ON_ERROR_STOP=1']
    result = apply_transaction(command, env, output, baseline, expected, Path(__file__).resolve().parent,
                               migration_name=migration_name)
    env.pop('PGPASSWORD', None)
    (output / 'safe-summary.json').write_text(json.dumps(result, indent=2))
    (root / (label + '.safe-summary.json')).write_text(json.dumps(result, indent=2))
    print(result['status'])
    return 0 if result['committed'] else 2


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        print('WEB_CREDITS_PRECHECK_FAILED_STOP')
        sys.exit(1)
