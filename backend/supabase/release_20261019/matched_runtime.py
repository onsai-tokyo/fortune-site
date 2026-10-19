"""Fresh local PG17.6 + unmodified official Supabase migrate.sh initialization.

No production connection, passwords, role dump replay, or role renaming.
Use an encrypted root for real-data rehearsals; standalone smoke is synthetic only.
"""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import tempfile
from scoped_rehearsal import NETWORK_PROFILE, Stop


class MatchedDatabase:
    def __init__(self, runtime, root):
        self.runtime = Path(runtime).resolve()
        self.root = Path(root).resolve()
        self.data = self.root / 'matched-pgdata'
        self.socket = None
        self.port = '54329'
        self.started = False
        self.env = {k: os.environ[k] for k in ('HOME', 'LANG', 'TMPDIR', 'USER') if k in os.environ}
        self.env.update(PATH=str(self.runtime / 'bin') + ':/usr/bin:/bin', PGPASSFILE='/dev/null',
                        PGCONNECT_TIMEOUT='15', POSTGRES_DB='postgres', POSTGRES_PASSWORD='')

    def run(self, command, code, timeout=240):
        result = subprocess.run(['/usr/bin/sandbox-exec', '-p', NETWORK_PROFILE, *map(str, command)],
                                cwd=self.root, env=self.env, capture_output=True, timeout=timeout)
        with (self.root / 'private-matched-bootstrap.log').open('ab') as log:
            log.write(result.stdout)
            log.write(result.stderr)
        if result.returncode or re.search(rb'(?m)^(?:psql:.*: )?(?:ERROR|FATAL|PANIC):', result.stderr):
            raise Stop(code)
        return result.stdout

    def sql(self, text):
        path = self.root / 'private-bootstrap-query.sql'
        path.write_text(text)
        return self.run([self.runtime / 'bin/psql', '-X', '-qAt', '-h', self.socket, '-p', self.port,
                         '-U', 'supabase_admin', '-d', 'postgres', '--no-password',
                         '-v', 'ON_ERROR_STOP=1', '-f', path], 'MATCHED_SQL_FAILED')

    def start(self):
        if self.data.exists():
            raise Stop('FRESH_MATCHED_DATABASE_REQUIRED')
        version = self.run([self.runtime / 'bin/postgres', '--version'], 'MATCHED_BINARY_FAILED').strip()
        if version != b'postgres (PostgreSQL) 17.6':
            raise Stop('MATCHED_POSTGRES_VERSION_REQUIRED')
        control = self.runtime / 'share/postgresql/extension/pg_graphql.control'
        if "default_version = '1.5.11'" not in control.read_text():
            raise Stop('MATCHED_GRAPHQL_VERSION_REQUIRED')
        self.run(['/usr/bin/python3', '-c',
                  'import socket; s=socket.socket(); s.settimeout(1); r=s.connect_ex(("1.1.1.1",443)); s.close(); raise SystemExit(0 if r in (1,13) else 1)'],
                 'MATCHED_NETWORK_ISOLATION_FAILED')
        self.socket = Path(tempfile.mkdtemp(prefix='fl-match-sock-', dir='/private/tmp'))
        os.chmod(self.socket, 0o700)
        self.run([self.runtime / 'bin/initdb', '-D', self.data, '-U', 'supabase_admin',
                  '--auth-local=trust', '--auth-host=reject', '--encoding=UTF8', '--locale=C'], 'MATCHED_INITDB_FAILED')
        # This empty cluster is not a usable rehearsal baseline until the full
        # official initialization below succeeds and its contracts are checked.
        self.started = True
        self.run([self.runtime / 'bin/pg_ctl', '-D', self.data, '-l', self.root / 'private-matched-server.log',
                  '-o', f"-h '' -k {self.socket} -p {self.port} -c shared_preload_libraries=pg_stat_statements,supautils -c wal_level=logical",
                  '-w', 'start'], 'MATCHED_SERVER_START_FAILED')
        self.env.update(POSTGRES_HOST=str(self.socket), POSTGRES_PORT=self.port)
        # Vendor migrate.sh creates postgres and executes every packaged init
        # and migration SQL in order with ON_ERROR_STOP. No file edits/skips.
        self.run(['/bin/sh', self.runtime / 'share/supabase-cli/migrations/migrate.sh'],
                 'OFFICIAL_MATCHED_INITIALIZATION_FAILED', timeout=300)
        self.sql("CREATE EXTENSION IF NOT EXISTS pg_graphql WITH SCHEMA graphql VERSION '1.5.11';")
        ready = self.sql("SELECT current_setting('server_version_num')::int=170006"
                         " AND to_regprocedure('auth.uid()') IS NOT NULL AND to_regclass('auth.users') IS NOT NULL"
                         " AND to_regnamespace('extensions') IS NOT NULL"
                         " AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role' AND rolbypassrls)"
                         " AND (SELECT extversion='1.5.11' FROM pg_extension WHERE extname='pg_graphql');").strip()
        if ready != b't':
            raise Stop('OFFICIAL_MATCHED_CONTRACT_FAILED')
        return str(self.socket), self.port

    def stop(self):
        try:
            if self.started:
                self.run([self.runtime / 'bin/pg_ctl', '-D', self.data, '-m', 'fast', '-w', 'stop'], 'MATCHED_STOP_FAILED')
                if (self.data / 'postmaster.pid').exists():
                    return False
                self.started = False
            if self.socket:
                self.socket.rmdir()
            return True
        except Exception:
            return False


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--runtime', type=Path, required=True)
    parser.add_argument('--synthetic-workspace', type=Path, required=True)
    args = parser.parse_args()
    os.umask(0o077)
    args.synthetic_workspace.mkdir(mode=0o700, parents=False, exist_ok=False)
    db = MatchedDatabase(args.runtime, args.synthetic_workspace)
    status = 'MATCHED_BOOTSTRAP_NOT_COMPLETED'
    try:
        db.start()
        status = 'OFFICIAL_MATCHED_BOOTSTRAP_OK'
    except Exception as error:
        status = str(error) if isinstance(error, Stop) else 'MATCHED_BOOTSTRAP_ERROR'
    finally:
        stopped = db.stop()
        summary = {'status': status, 'server_stopped': stopped, 'production_connection': 'NONE', 'real_data_used': False}
        (args.synthetic_workspace / 'safe-summary.json').write_text(json.dumps(summary, indent=2))
        print(json.dumps(summary))
    raise SystemExit(0 if status == 'OFFICIAL_MATCHED_BOOTSTRAP_OK' and stopped else 1)


if __name__ == '__main__':
    main()
