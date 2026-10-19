"""Same scoped checks, on official matched PG17.6 initialization and recorded ACLs."""
import argparse
import json
import os
from pathlib import Path
import traceback
from scoped_rehearsal import Rehearsal, Stop
from matched_runtime import MatchedDatabase
from local_rehearsal_acl import plan_local_acl
from production_preflight import differences
from generate_rollbacks import render


class MatchedRehearsal(Rehearsal):
    def prepare_database(self, major):
        if major != 17:
            raise Stop('MATCHED_MAJOR_17_REQUIRED')
        self.summary['source_major'] = major
        self.stage('official_matched_initialization')
        self.database = MatchedDatabase(self.args.runtime, self.root)
        self.connection = self.database.start()
        self.started = True
        self.summary['checks'] += ['external_tcp_denied', 'official_initialization_and_major']

    def stop(self):
        return self.database.stop() if hasattr(self, 'database') else True

    def after_schema_restore(self):
        self.stage('local_acl_alignment_to_recorded_production')
        production = json.loads(self.args.production_baseline.read_text())
        if production.get('server_version_num') != 170006:
            raise Stop('RECORDED_PRODUCTION_VERSION_UNEXPECTED')
        before = self.snapshot('before-local-acl-alignment.json')
        sql = plan_local_acl(before, production)
        (self.root / 'private-local-acl-alignment.sql').write_text(sql)
        self.sql(sql)
        after = self.snapshot('matched-production-comparison.json')
        changed = differences(after, production)
        if changed:
            self.summary['changed_sections'] = changed
            raise Stop('MATCHED_PRODUCTION_STRUCTURE_DIFFERENT_STOP')
        # Record production-specific rollback definitions even though they are
        # NEVER executed against production by this local-only runner.
        for name, text in render(production, self.release).items():
            (self.root / ('production-' + name)).write_text(text)
        self.summary['checks'].append('recorded_production_structure_identical')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--attempt', type=Path, required=True)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--production-baseline', type=Path, required=True)
    parser.add_argument('--client-bin', type=Path, default=Path('/opt/homebrew/opt/libpq/bin'))
    args = parser.parse_args()
    if not args.attempt.is_dir() or any(args.attempt.iterdir()):
        raise SystemExit('FRESH_EMPTY_ATTEMPT_REQUIRED')
    # The owner-operated CLI is for real backup data. Synthetic tests instantiate
    # the class directly; do not allow accidental plaintext real-data output.
    volume = args.attempt.resolve().parent
    if (not volume.is_mount() or not args.archive.resolve().parent.is_mount() or
        not args.production_baseline.resolve().is_relative_to(volume) or
        args.production_baseline.is_symlink() or args.archive.is_symlink()):
        raise SystemExit('ENCRYPTED_BACKUP_AND_WORK_VOLUMES_REQUIRED')
    os.umask(0o077)
    runner = MatchedRehearsal(args)
    try:
        runner.execute()
    except Exception as error:
        runner.summary['status'] = str(error) if isinstance(error, Stop) else 'LOCAL_MATCHED_REHEARSAL_ERROR'
        with (runner.root / 'private-exception.log').open('w') as log:
            traceback.print_exc(file=log)
    finally:
        stopped = runner.stop()
        runner.summary['server_stopped'] = stopped
        if not stopped:
            runner.summary['status'] = 'LOCAL_SERVER_STOP_FAILED'
        (runner.root / 'summary.json').write_text(json.dumps(runner.summary, indent=2))
        print('RESULT=' + runner.summary['status'], flush=True)
    raise SystemExit(0 if runner.summary['status'] == 'SCOPED_REHEARSAL_OK' else 1)


if __name__ == '__main__':
    main()
