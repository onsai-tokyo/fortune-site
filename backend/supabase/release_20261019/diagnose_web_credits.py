"""Offline fixed-code diagnosis only. Never prints log text, rows or SQL."""
import argparse
import json
from pathlib import Path


PATTERNS = {
    'LOCK_TIMEOUT': (b'lock timeout',),
    'STATEMENT_TIMEOUT': (b'statement timeout',),
    'AUTHENTICATION_FAILURE': (b'password authentication failed', b'authentication failed'),
    'TLS_FAILURE': (b'certificate verify failed', b'ssl error', b'root certificate'),
    'CONNECTION_FAILURE': (b'connection refused', b'connection timed out', b'could not connect',
                           b'server closed the connection', b'connection to server'),
    'POOL_CAPACITY': (b'maxclients', b'max client connections', b'pool_size', b'pool size'),
    'SQL_PERMISSION_FAILURE': (b'permission denied', b'must be owner'),
    'SQL_SYNTAX_FAILURE': (b'syntax error',),
}


def classify(attempt):
    # All names, sizes, contents and arbitrary exception messages remain private.
    for name in ('safe-summary.json', 'before.json', 'after-before-commit.json', 'private-errors.log'):
        if (attempt / name).is_symlink():
            raise RuntimeError('DIAGNOSTIC_SYMLINK_STOP')
    summary = json.loads((attempt / 'safe-summary.json').read_text())
    if summary.get('status') != 'CATALOG_QUERY_TIMEOUT' or summary.get('committed') is not False:
        raise RuntimeError('UNEXPECTED_APPLY_STATUS_STOP')
    before = (attempt / 'before.json').exists()
    after = (attempt / 'after-before-commit.json').exists()
    stage = 'POST_SNAPSHOT_PRESENT' if after else 'WAITING_POST_APPLY_SNAPSHOT' if before else 'WAITING_PRE_APPLY_SNAPSHOT'
    log = attempt / 'private-errors.log'
    if log.stat().st_size > 16 * 1024 * 1024:
        raise RuntimeError('DIAGNOSTIC_LOG_TOO_LARGE_STOP')
    raw = log.read_bytes().lower()
    codes = [code for code, patterns in PATTERNS.items() if any(p in raw for p in patterns)]
    if not codes:
        codes = ['UNCLASSIFIED_ERROR_PRESENT' if b'error:' in raw or b'fatal:' in raw
                 else 'NO_KNOWN_ERROR_MESSAGE']
    return {'status': 'OFFLINE_APPLY_DIAGNOSIS_READY', 'phase': stage, 'error_codes': codes,
            'production_connection': 'NONE', 'private_values_emitted': False}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--encrypted-volume', type=Path, required=True)
    args = parser.parse_args()
    root = args.encrypted_volume.resolve()
    if not root.is_mount():
        raise RuntimeError('ENCRYPTED_MOUNT_REQUIRED')
    attempts = [p.parent for p in root.glob('production-web-credits-*/safe-summary.json')]
    if len(attempts) != 1 or attempts[0].is_symlink():
        raise RuntimeError('APPLY_RECORD_NOT_UNIQUE_STOP')
    print(json.dumps(classify(attempts[0]), indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print('{"status":"OFFLINE_APPLY_DIAGNOSIS_FAILED_STOP","production_connection":"NONE"}')
        raise SystemExit(1)
