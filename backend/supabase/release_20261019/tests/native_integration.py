"""Generate a synthetic archive and run the entire scoped flow. No real backup.

Example: python3 -B tests/native_integration.py --workspace <NEW directory>
 --cli <official CLI> --artifact-cache <public artifact cache>
"""
import argparse
import os
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--workspace', type=Path, required=True)
    parser.add_argument('--cli', type=Path, required=True)
    parser.add_argument('--artifact-cache', type=Path, required=True)
    args = parser.parse_args()
    os.umask(0o077)
    root = args.workspace.resolve()
    root.mkdir(mode=0o700, parents=False, exist_ok=False)
    release = Path(__file__).resolve().parent.parent
    cli = args.cli.resolve()
    home = root / 'source-cli-home'
    home.mkdir()
    (home / 'cache').mkdir()
    (home / 'cache/stack').symlink_to(args.artifact_cache.resolve(), target_is_directory=True)
    (root / 'supabase').mkdir()
    (root / 'supabase/config.toml').write_text('project_id="synthetic-only"\n[experimental]\nstack=true\n[db]\nmajor_version=17\n')
    env = {k: os.environ[k] for k in ('HOME', 'PATH', 'LANG', 'TMPDIR', 'USER') if k in os.environ}
    env.update(SUPABASE_HOME=str(home), SUPABASE_EXPERIMENTAL_STACK='1', PGPASSFILE='/dev/null')

    def run(command):
        with (root / 'synthetic-private.log').open('ab') as log:
            result = subprocess.run([str(c) for c in command], cwd=root, env=env, stdout=log, stderr=log)
        if result.returncode:
            raise RuntimeError('SYNTHETIC_SOURCE_OPERATION_FAILED')

    started = False
    try:
        run([cli, 'telemetry', 'disable'])
        run([cli, 'stack', 'prepare', '--runtime', 'native', '--stack', 'source', '--capability', 'database'])
        started = True
        run([cli, 'stack', 'start', '--runtime', 'native', '--stack', 'source', '--preparation', 'on-demand', '--exclude', 'rest,auth,realtime,storage,functions,studio,mail,analytics,pooler'])
        pids = list((home / 'stacks').rglob('postmaster.pid'))
        assert len(pids) == 1
        lines = pids[0].read_text().splitlines()
        assert Path(lines[1]).resolve().is_relative_to(root)
        port, socket = lines[3:5]
        psql = ['/opt/homebrew/opt/libpq/bin/psql', '-X', '-qAt', '-h', socket, '-p', port,
                '-U', 'supabase_admin', '-d', 'postgres', '--no-password', '-v', 'ON_ERROR_STOP=1']
        run(psql + ['-f', release / 'tests/synthetic-schema.sql'])
        run(psql + ['-f', release / 'tests/synthetic-archive-seed.sql'])
        archive = root / 'synthetic.dump'
        run(['/opt/homebrew/opt/libpq/bin/pg_dump', '-h', socket, '-p', port, '-U', 'supabase_admin',
             '-d', 'postgres', '--no-password', '--format=custom', '--schema=public', '--file', archive])
    finally:
        if started:
            run([cli, 'stack', 'stop', '--stack', 'source'])
    attempt = root / 'attempt-synthetic'
    attempt.mkdir()
    result = subprocess.run([sys.executable, '-B', release / 'scoped_rehearsal.py', '--archive', archive,
        '--attempt', attempt, '--cli', cli, '--artifact-cache', args.artifact_cache.resolve()], cwd=root)
    raise SystemExit(result.returncode)


if __name__ == '__main__':
    main()
