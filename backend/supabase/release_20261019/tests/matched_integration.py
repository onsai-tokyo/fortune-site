"""Fictional source archive + full matched-runtime scoped rehearsal. No real data."""
import argparse
import json
import os
from pathlib import Path
from types import SimpleNamespace
from matched_runtime import MatchedDatabase
from matched_rehearsal import MatchedRehearsal


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--runtime', type=Path, required=True)
    p.add_argument('--workspace', type=Path, required=True)
    args = p.parse_args()
    os.umask(0o077)
    args.workspace.mkdir(mode=0o700, parents=False, exist_ok=False)
    source = args.workspace / 'source'
    source.mkdir()
    db = MatchedDatabase(args.runtime, source)
    release = Path(__file__).resolve().parent.parent
    archive = args.workspace / 'synthetic.dump'
    baseline = args.workspace / 'synthetic-production-baseline.json'
    try:
        db.start()
        db.sql((release / 'tests/synthetic-schema.sql').read_text())
        db.sql((release / 'tests/synthetic-archive-seed.sql').read_text())
        # Fictional production ACLs intentionally omit the target's excess defaults.
        db.sql('BEGIN; SET LOCAL SESSION AUTHORIZATION postgres;' + ''.join(
            f'REVOKE ALL ON public.{table} FROM anon,authenticated;'
            for table in ('ai_books', 'ai_book_credits', 'ai_book_grants', 'partner_profiles')) + 'COMMIT;')
        baseline.write_bytes(db.sql((release / 'preflight.sql').read_text()))
        db.run([args.runtime / 'bin/pg_dump', '-h', db.socket, '-p', db.port, '-U', 'supabase_admin',
                '-d', 'postgres', '--no-password', '--schema=public', '--format=custom', '--file', archive], 'SYNTHETIC_DUMP_FAILED')
    finally:
        if not db.stop():
            raise RuntimeError('SYNTHETIC_SOURCE_STOP_FAILED')
    attempt = args.workspace / 'attempt'
    attempt.mkdir()
    runner = MatchedRehearsal(SimpleNamespace(archive=archive, attempt=attempt, runtime=args.runtime,
                               production_baseline=baseline, client_bin=Path('/opt/homebrew/opt/libpq/bin')))
    try:
        runner.execute()
    finally:
        stopped = runner.stop()
        runner.summary['server_stopped'] = stopped
        (attempt / 'summary.json').write_text(json.dumps(runner.summary, indent=2))
        if not stopped:
            raise RuntimeError('SYNTHETIC_TARGET_STOP_FAILED')
    print(json.dumps(runner.summary, indent=2))


if __name__ == '__main__':
    main()
