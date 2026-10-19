"""Fictional local DB only: failed comparison rolls back; approved one commits."""
import argparse
import copy
import json
import os
from pathlib import Path
from apply_web_credits import apply_transaction, drift, QUESTION_MIGRATION, SAVES_MIGRATION
from matched_runtime import MatchedDatabase
from scoped_rehearsal import NETWORK_PROFILE


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--workspace', type=Path, required=True)
    parser.add_argument('--expected', type=Path, required=True)
    parser.add_argument('--client-bin', type=Path)
    args = parser.parse_args()
    os.umask(0o077)
    args.workspace.mkdir(mode=0o700, exist_ok=False)
    release = Path(__file__).resolve().parent.parent
    db = MatchedDatabase(args.runtime, args.workspace)
    try:
        db.start()
        db.sql((release / 'tests/synthetic-schema.sql').read_text())
        db.sql((release / 'tests/synthetic-archive-seed.sql').read_text())
        db.sql('BEGIN; SET LOCAL SESSION AUTHORIZATION postgres;' + ''.join(
            f'REVOKE ALL ON public.{t} FROM anon,authenticated;'
            for t in ('ai_books', 'ai_book_credits', 'ai_book_grants', 'partner_profiles')) + 'COMMIT;')
        query = (release / 'preflight.sql').read_text()
        baseline = json.loads(db.sql(query))
        expected = json.loads(args.expected.read_text())
        client = (args.client_bin or args.runtime / 'bin') / 'psql'
        command = ['/usr/bin/sandbox-exec', '-p', NETWORK_PROFILE, str(client),
                   '-X', '-qAt', '-h', str(db.socket), '-p', db.port, '-U', 'postgres',
                   '-d', 'postgres', '--no-password', '-v', 'ON_ERROR_STOP=1']
        pre_drift = args.workspace / 'pre-drift'
        pre_drift.mkdir()
        invalid = dict(baseline, server_version_num=170011)
        result = apply_transaction(command, db.env, pre_drift, invalid, expected, release)
        assert result['status'] == 'PRE_APPLY_DRIFT_STOP', result
        assert not drift(baseline, json.loads(db.sql(query)))
        # A real fractional/JSON/COPY row is not needed here: these tests check
        # catalog guards and rollback, leaving all fictional data unchanged.
        for section in ('constraints', 'functions', 'tables', 'extensions', 'foreign_keys_to_partial_scope'):
            folder = args.workspace / ('bad-' + section)
            folder.mkdir()
            bad = copy.deepcopy(expected)
            bad[section] = [] if bad[section] else [{'unexpected': True}]
            result = apply_transaction(command, db.env, folder, baseline, bad, release)
            assert result['status'] == 'POST_APPLY_DIFFERENCE_ROLLBACK', (section, result)
            assert not drift(baseline, json.loads(db.sql(query)))
        failed = args.workspace / 'failed-check'
        failed.mkdir()
        result = apply_transaction(command, db.env, failed, baseline, baseline, release)
        assert result['status'] == 'POST_APPLY_DIFFERENCE_ROLLBACK', result
        assert not drift(baseline, json.loads(db.sql(query)))
        passed = args.workspace / 'successful-check'
        passed.mkdir()
        result = apply_transaction(command, db.env, passed, baseline, expected, release)
        assert result['committed'] is True, result
        assert not drift(expected, json.loads(db.sql(query)))
        # Second migration is independently guarded: refuse a wrong post-state,
        # prove rollback, then apply exactly the second SQL on top of step one.
        next_expected = json.loads(args.expected.with_name('after-2.json').read_text())
        failed_second = args.workspace / 'second-failed'
        failed_second.mkdir()
        result = apply_transaction(command, db.env, failed_second, expected, expected, release,
                                   migration_name=QUESTION_MIGRATION)
        assert result['status'] == 'POST_APPLY_DIFFERENCE_ROLLBACK', result
        assert not drift(expected, json.loads(db.sql(query)))
        passed_second = args.workspace / 'second-success'
        passed_second.mkdir()
        result = apply_transaction(command, db.env, passed_second, expected, next_expected, release,
                                   migration_name=QUESTION_MIGRATION)
        assert result['status'] == 'BOOK_QUESTIONS_APPLIED_VERIFIED' and result['committed'], result
        assert not drift(next_expected, json.loads(db.sql(query)))
        third_expected = json.loads(args.expected.with_name('after-3.json').read_text())
        failed_third = args.workspace / 'third-failed'
        failed_third.mkdir()
        result = apply_transaction(command, db.env, failed_third, next_expected, next_expected, release,
                                   migration_name=SAVES_MIGRATION)
        assert result['status'] == 'POST_APPLY_DIFFERENCE_ROLLBACK', result
        assert not drift(next_expected, json.loads(db.sql(query)))
        passed_third = args.workspace / 'third-success'
        passed_third.mkdir()
        result = apply_transaction(command, db.env, passed_third, next_expected, third_expected, release,
                                   migration_name=SAVES_MIGRATION)
        assert result['status'] == 'READING_SAVES_APPLIED_VERIFIED' and result['committed'], result
        assert not drift(third_expected, json.loads(db.sql(query)))
        db.sql((release / 'tests/restored-partner-trigger.sql').read_text())
        assert not drift(third_expected, json.loads(db.sql(query)))
        print('SYNTHETIC_THIRD_APPLY_ROLLBACK_AND_PARTNER_DELETE_OK')
        print('SYNTHETIC_SECOND_APPLY_AND_FAILURE_ROLLBACK_OK')
        print('SYNTHETIC_APPLY_AND_FAILURE_ROLLBACK_OK')
    finally:
        assert db.stop(), 'LOCAL_STOP_FAILED'


if __name__ == '__main__':
    main()
