"""Owner-operated B0: catalog SELECT only; all private output stays encrypted."""
import argparse
import copy
import json
import os
from pathlib import Path
import subprocess
import sys
from generate_rollbacks import render, validate


def normalized(value):
    if isinstance(value, dict):
        return {k: normalized(v) for k, v in value.items()}
    if isinstance(value, list):
        return sorted((normalized(v) for v in value), key=lambda v: json.dumps(v, sort_keys=True))
    return value


def differences(before, after):
    """Ignore capture/session metadata and OID-derived internal trigger names only."""
    result = []
    for key in ('format_version', 'constraints', 'functions', 'tables', 'foreign_keys_to_partial_scope'):
        values = []
        for snapshot in (before, after):
            value = copy.deepcopy(snapshot.get(key))
            if key == 'tables' and value:
                for table in value:
                    table['triggers'] = [t for t in table.get('triggers', []) if not t['internal']]
            values.append(normalized(value))
        if values[0] != values[1]:
            result.append(key)
    if before['server_version_num'] // 10000 != after['server_version_num'] // 10000:
        result.append('postgres_major')
    # Fail closed on an extension difference; report it, never assume irrelevant.
    for key in ('extensions',):
        values = [[{k: e[k] for k in ('name', 'version', 'schema')} for e in s[key]]
                  for s in (before, after)]
        if normalized(values[0]) != normalized(values[1]):
            result.append(key)
    return result


def select_matched_baseline(root):
    """Never compare against the superseded PG17.11 rehearsal."""
    candidates = []
    for p in root.glob('attempt-matched-*/summary.json'):
        if p.is_symlink() or p.parent.is_symlink():
            raise RuntimeError('BASELINE_SYMLINK_STOP')
        value = json.loads(p.read_text())
        if (value.get('status') == 'SCOPED_REHEARSAL_OK' and
                value.get('server_stopped') is True and
                value.get('production_connection') == 'NONE' and
                value.get('rehearsal_server_version') == '17.6' and
                'recorded_production_structure_identical' in value.get('checks', [])):
            candidates.append(p.parent)
    if len(candidates) != 1:
        raise RuntimeError('SUCCESSFUL_MATCHED_BASELINE_NOT_UNIQUE')
    path = candidates[0] / 'baseline.json'
    if path.is_symlink():
        raise RuntimeError('BASELINE_SYMLINK_STOP')
    baseline = json.loads(path.read_text())
    validate(baseline)
    if baseline.get('server_version_num') != 170006:
        raise RuntimeError('MATCHED_BASELINE_VERSION_STOP')
    return baseline


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--encrypted-volume', type=Path, required=True)
    args = parser.parse_args()
    os.umask(0o077)
    root = args.encrypted_volume.resolve()
    if not root.is_mount():
        raise RuntimeError('ENCRYPTED_MOUNT_REQUIRED')
    baseline = select_matched_baseline(root)
    import tempfile
    output = Path(tempfile.mkdtemp(prefix='production-preflight-', dir=root))
    release = Path(__file__).resolve().parent
    env = {k: os.environ[k] for k in ('PATH', 'LANG', 'TMPDIR', 'HOME') if k in os.environ}
    env.update(PGPASSWORD=os.environ['PGPASSWORD'], PGPASSFILE='/dev/null',
               PGSSLMODE='verify-full', PGSSLROOTCERT=os.environ['PGSSLROOTCERT'],
               PGCONNECT_TIMEOUT='15', PGAPPNAME='fatelab-b0-catalog-readonly',
               PGOPTIONS='-c default_transaction_read_only=on -c lock_timeout=10000')
    os.environ.pop('PGPASSWORD', None)
    command = ['/opt/homebrew/opt/libpq/bin/psql', '-X', '-qAt', '--no-password',
               '--host=aws-1-ap-northeast-1.pooler.supabase.com', '--port=5432',
               '--username=postgres.jarerymytxcsqvzduqub', '--dbname=postgres',
               '-v', 'ON_ERROR_STOP=1', '-f', str(release / 'preflight.sql')]
    with (output / 'production-baseline.json').open('wb') as stdout, (output / 'private-errors.log').open('wb') as stderr:
        result = subprocess.run(command, env=env, stdout=stdout, stderr=stderr)
    env.pop('PGPASSWORD', None)
    if result.returncode:
        print('B0_CATALOG_READ_FAILED')
        return 1
    production = json.loads((output / 'production-baseline.json').read_text())
    validate(production)
    changed = differences(baseline, production)
    if baseline['server_version_num'] != production['server_version_num']:
        changed.append('postgres_exact_version')
    summary = {'status': 'B0_MATCH' if not changed else 'B0_DIFFERENCES_STOP',
               'changed_sections': changed, 'production_sql_applied': False,
               'production_version': production['server_version'],
               'rehearsal_version': baseline['server_version'],
               'production_extensions': [{k: e[k] for k in ('name', 'version', 'schema')} for e in production['extensions']]}
    # Render but NEVER execute production-specific inverse SQL, only on a match.
    if not changed:
        inverse = output / 'rollback'
        inverse.mkdir()
        for filename, sql in render(production, release).items():
            (inverse / filename).write_text(sql)
    (root / 'production-preflight.safe-summary.json').write_text(json.dumps(summary, indent=2))
    print(summary['status'])
    return 0 if not changed else 2


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception:
        # Raw catalog/log/exception text is deliberately not printed.
        print('B0_PRECHECK_OR_METADATA_FAILED_STOP')
        sys.exit(1)
