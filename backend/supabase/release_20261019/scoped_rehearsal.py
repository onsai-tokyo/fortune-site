"""Owner-operated, encrypted, local-only rehearsal. Not a production runner.

Launch through the new scoped helper; never through the old Test/Resume scripts.
No roles dump is replayed or edited. Uses official Supabase CLI initialization.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import traceback
import uuid
from datetime import datetime, timezone

from generate_rollbacks import canonical, render

TABLES = ('ai_book_grants', 'ai_books', 'ai_book_credits', 'partner_profiles')
COPY_HEADER = re.compile(r'^COPY public\.(ai_book_grants|ai_books|ai_book_credits|partner_profiles) \(([^)]+)\) FROM stdin;$')
FUNCTION_ERROR = re.compile(r'function ([A-Za-z_][A-Za-z0-9_.]*\([A-Za-z0-9_. ,\[\]"]{0,250}\)) does not exist')
EXCLUDED = 'rest,auth,realtime,storage,functions,studio,mail,analytics,pooler'
NETWORK_PROFILE = ('(version 1)(allow default)(deny network*)'
                   '(allow network* (local unix-socket))'
                   '(allow network-outbound (remote unix-socket))'
                   '(allow network-inbound (local ip "localhost:*"))'
                   '(allow network-outbound (remote ip "localhost:*"))')


class Stop(Exception):
    pass


def parse_copy(text):
    """Parse pg_dump TEXT COPY only. Never print row values or identifiers."""
    copies = {}
    owners = set()
    active = None
    for line in text.split('\n'):
        if active:
            if line == r'\.':
                active = None
                continue
            current = copies[active]
            fields = line.split('\t')
            if len(fields) != len(current['columns']):
                raise Stop('COPY_FIELD_COUNT_MISMATCH')
            current['rows'].append(line)
            if 'user_id' in current['columns']:
                raw = fields[current['columns'].index('user_id')]
                try:
                    value = str(uuid.UUID(raw))
                except ValueError:
                    raise Stop('COPY_OWNER_UUID_INVALID') from None
                if value != raw.lower():
                    raise Stop('COPY_OWNER_UUID_NOT_CANONICAL')
                owners.add(value)
        elif match := COPY_HEADER.fullmatch(line):
            name = match[1]
            if name in copies:
                raise Stop('COPY_DUPLICATE_TABLE_BLOCK')
            columns = [c.strip().strip('"') for c in match[2].split(',')]
            if any(not re.fullmatch(r'[a-z_][a-z0-9_]*', c) for c in columns):
                raise Stop('COPY_COLUMN_UNSUPPORTED')
            copies[name] = {'columns': columns, 'rows': []}
            active = name
        elif line.startswith('COPY ') or line.startswith('INSERT INTO '):
            raise Stop('COPY_FORMAT_OR_SCOPE_UNSUPPORTED')
    if active or set(copies) != set(TABLES):
        raise Stop('COPY_TABLE_SCOPE_INCOMPLETE')
    return copies, owners


def row_digest(rows):
    digest = hashlib.sha256()
    for row in sorted(rows):
        data = row.encode('utf-8')
        digest.update(len(data).to_bytes(8, 'big'))
        digest.update(data)
    return digest.hexdigest()


def copy_output_lines(raw):
    lines = raw.decode('utf-8').split('\n')
    if lines and lines[-1] == '':
        lines.pop()
    return lines


def copy_order(foreign_keys):
    dependencies = {name: set() for name in TABLES}
    for fk in foreign_keys:
        child, parent = fk['table'], fk['parent']
        if child.startswith('public.') and parent.startswith('public.'):
            child, parent = child[7:], parent[7:]
            if child in dependencies and parent in dependencies:
                dependencies[child].add(parent)
    ordered = []
    while dependencies:
        ready = [name for name in TABLES if name in dependencies and not dependencies[name]]
        if not ready:
            raise Stop('CYCLIC_PARTIAL_DATA_SCOPE_REQUIRES_PLAN')
        for name in ready:
            ordered.append(name)
            del dependencies[name]
            for parents in dependencies.values():
                parents.discard(name)
    return ordered


def ordered_copy_sql(copies, order):
    text = "SET client_encoding='UTF8';\nSET standard_conforming_strings=on;\nSET DateStyle='ISO';\nSET TIME ZONE 'UTC';\n"
    for name in order:
        columns = ','.join(qi(c) for c in copies[name]['columns'])
        text += f'COPY public.{name} ({columns}) FROM stdin;\n'
        text += ''.join(row + '\n' for row in copies[name]['rows']) + '\\.\n'
    return text


def qi(value):
    return '"' + value.replace('"', '""') + '"'


def canonical_copy_rows(rows, columns, table_metadata):
    """Compare timestamptz instants, not session-dependent +09/+00 spellings.

    All other COPY fields, including timestamp WITHOUT time zone, stay exact.
    No row values appear in errors or summaries.
    """
    types = {c['name']: c['type'] for c in table_metadata['columns']}
    indexes = [i for i, name in enumerate(columns)
               if re.fullmatch(r'timestamp(?:\(\d+\))? with time zone', types.get(name, ''))]
    result = []
    for row in rows:
        fields = row.split('\t')
        if len(fields) != len(columns):
            raise Stop('COPY_CANONICAL_FIELD_COUNT_MISMATCH')
        for index in indexes:
            if fields[index] in (r'\N', 'infinity', '-infinity'):
                continue
            try:
                # PostgreSQL emits whole-hour offsets as +09/+00; Python3.9
                # requires +09:00/+00:00. Preserve the instant, not the spelling.
                timestamp = re.sub(r'([+-]\d{2})$', r'\1:00', fields[index])
                # Python 3.9 accepts only 3/6 fractional digits. PostgreSQL
                # legitimately omits trailing zeroes. Pad, never round/truncate.
                timestamp = re.sub(r'(\d{2}:\d{2}:\d{2})\.(\d{1,6})(?=[+-])',
                                   lambda m: m[1] + '.' + m[2].ljust(6, '0'), timestamp)
                value = datetime.fromisoformat(timestamp)
                if value.tzinfo is None:
                    raise ValueError('timezone missing')
                fields[index] = value.astimezone(timezone.utc).isoformat(timespec='microseconds')
            except (ValueError, OverflowError):
                raise Stop('COPY_TIMESTAMP_CANONICALIZATION_UNSUPPORTED') from None
        result.append('\t'.join(fields))
    return result


class Rehearsal:
    def __init__(self, args):
        self.args = args
        self.root = args.attempt.resolve()
        self.home = self.root / 'cli-home'
        self.release = Path(__file__).resolve().parent
        self.summary = {'status': 'NOT_COMPLETED', 'production_connection': 'NONE', 'checks': [],
                        'real_auth_rows_copied': False, 'stage': 'prepare'}
        self.started = False
        self.pid = None
        self.connection = None
        self.counter = 0
        self.phase = 'DDL'
        self.env = {k: os.environ[k] for k in ('HOME', 'PATH', 'TMPDIR', 'LANG', 'USER') if k in os.environ}
        self.env.update(SUPABASE_HOME=str(self.home), SUPABASE_EXPERIMENTAL_STACK='1',
                        PGPASSFILE='/dev/null', PGCONNECT_TIMEOUT='15')

    def stage(self, name):
        self.summary['stage'] = name
        (self.root / 'state.json').write_text(json.dumps(self.summary, indent=2))
        print('STAGE=' + name, flush=True)

    def run(self, command, code, *, data=False, expect_failure=False, timeout=240):
        result = subprocess.run([str(c) for c in command], cwd=self.root, env=self.env,
                                stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=timeout)
        with (self.root / 'private-process.log').open('ab') as log:
            log.write(result.stderr)
            if result.returncode:
                log.write(result.stdout)
        if expect_failure:
            if result.returncode == 0:
                raise Stop('EXPECTED_REAPPLY_FAILURE_MISSING')
        elif result.returncode:
            if not data and self.phase == 'DDL':
                error = (result.stderr + result.stdout).decode('utf-8', errors='replace')
                if match := FUNCTION_ERROR.search(error):
                    self.summary['missing_function'] = match[1]
                for line in reversed(error.splitlines()):
                    if line.startswith('pg_restore: creating ') and re.fullmatch(r'[A-Za-z0-9_." (),\[\]-]{1,400}', line[21:]):
                        self.summary['failed_toc_context'] = line[12:]
                        break
            raise Stop(code)
        return result.stdout

    def cli(self, *args, **kw):
        return self.run([self.args.cli, *args], 'CLI_OPERATION_FAILED', **kw)

    def sql(self, text=None, file=None, *, administrator=False, extra=(), expect_failure=False):
        if file is None:
            self.counter += 1
            file = self.root / f'private-query-{self.counter:04d}.sql'
            file.write_text(text)
        command = [self.args.client_bin / 'psql', '-X', '-qAt', '-h', self.connection[0],
                   '-p', self.connection[1], '-U', 'supabase_admin', '-d', 'postgres',
                   '--no-password', '-v', 'ON_ERROR_STOP=1', *extra]
        if not administrator:
            # Reproduce production postgres permissions, including RESET ROLE.
            command += ['-c', 'SET SESSION AUTHORIZATION postgres;']
        command += ['-f', file]
        return self.run(command, 'LOCAL_SQL_FAILED', data=self.phase == 'COPY', expect_failure=expect_failure)

    def snapshot(self, name):
        raw = self.sql(file=self.release / 'preflight.sql')
        value = json.loads(raw)
        (self.root / name).write_bytes(raw)
        return value

    def discover_database(self):
        found = list((self.home / 'stacks').rglob('postmaster.pid'))
        if len(found) != 1:
            raise Stop('LOCAL_DATABASE_NOT_UNIQUE')
        lines = found[0].read_text().splitlines()
        if len(lines) < 5 or not Path(lines[1]).resolve().is_relative_to(self.root):
            raise Stop('DATABASE_OUTSIDE_ATTEMPT')
        if not lines[4].startswith('/'):
            raise Stop('UNIX_SOCKET_REQUIRED')
        self.pid = int(lines[0])
        self.connection = (lines[4], lines[3])

    def stop(self):
        if not self.started:
            return True
        try:
            self.cli('stack', 'stop', '--stack', 'scoped', timeout=90)
            # Validate that no owned postmaster remains before detaching storage.
            for pidfile in (self.home / 'stacks').rglob('postmaster.pid'):
                lines = pidfile.read_text().splitlines()
                if lines:
                    try:
                        os.kill(int(lines[0]), 0)
                        return False
                    except ProcessLookupError:
                        pass
            return True
        except Exception:
            return False

    def after_schema_restore(self):
        pass

    def prepare_database(self, major):
        self.summary['source_major'] = major
        self.home.mkdir(mode=0o700)
        (self.home / 'cache').mkdir()
        (self.home / 'cache' / 'stack').symlink_to(self.args.artifact_cache.resolve(), target_is_directory=True)
        (self.root / 'supabase').mkdir()
        (self.root / 'supabase' / 'config.toml').write_text(
            f'project_id="fatelab-scoped-local"\n[experimental]\nstack=true\n[db]\nmajor_version={major}\n')
        self.cli('telemetry', 'disable')
        self.stage('official_supabase_prepare')
        self.cli('stack', 'prepare', '--runtime', 'native', '--stack', 'scoped', '--capability', 'database', timeout=600)
        self.stage('official_supabase_initialize')
        self.run(['/usr/bin/sandbox-exec', '-p', NETWORK_PROFILE, sys.executable, '-c',
                  'import socket; s=socket.socket(); s.settimeout(1); r=s.connect_ex(("1.1.1.1",443)); s.close(); raise SystemExit(0 if r in (1,13) else 1)'],
                 'NETWORK_ISOLATION_NOT_CONFIRMED')
        self.summary['checks'].append('external_tcp_denied')
        self.started = True
        self.run(['/usr/bin/sandbox-exec', '-p', NETWORK_PROFILE, self.args.cli,
                  'stack', 'start', '--runtime', 'native', '--stack', 'scoped',
                  '--preparation', 'on-demand', '--exclude', EXCLUDED], 'SUPABASE_INITIALIZATION_FAILED')
        self.discover_database()
        ready = self.sql("SELECT current_setting('server_version_num')::int/10000=" + str(major) +
            " AND to_regprocedure('auth.uid()') IS NOT NULL AND to_regclass('auth.users') IS NOT NULL"
            " AND to_regnamespace('extensions') IS NOT NULL AND EXISTS(SELECT 1 FROM pg_roles WHERE rolname='service_role');",
            administrator=True).strip()
        if ready != b't':
            raise Stop('SUPABASE_VERSION_OR_INITIALIZATION_MISMATCH')
        self.summary['checks'].append('official_initialization_and_major')


    def execute(self):
        self.stage('archive_header')
        archive = self.args.archive.resolve()
        toc = self.run([self.args.client_bin / 'pg_restore', '--list', archive], 'ARCHIVE_LIST_FAILED')
        (self.root / 'private-archive-toc.txt').write_bytes(toc)
        match = re.search(rb'^;\s*Dumped from database version:\s*(\d+)\.', toc, re.M)
        if not match or int(match[1]) not in (15, 17):
            raise Stop('SOURCE_MAJOR_UNKNOWN_OR_UNSUPPORTED')
        major = int(match[1])
        self.prepare_database(major)
        self.stage('public_schema_restore')
        schema = self.root / 'private-public-schema.sql'
        self.run([self.args.client_bin / 'pg_restore', '--schema-only', '--schema=public', '--file', schema, archive], 'SCHEMA_EXPORT_FAILED')
        # A namespace is normally already present in a new Supabase database.
        # Remove it ONLY if it has no objects, using RESTRICT, never CASCADE.
        if re.search(r'^CREATE SCHEMA public;', schema.read_text(), re.M):
            empty = self.sql("SELECT NOT EXISTS(SELECT 1 FROM pg_class WHERE relnamespace='public'::regnamespace)"
                             " AND NOT EXISTS(SELECT 1 FROM pg_proc WHERE pronamespace='public'::regnamespace)"
                             " AND NOT EXISTS(SELECT 1 FROM pg_type WHERE typnamespace='public'::regnamespace);",
                             administrator=True).strip()
            if empty != b't':
                raise Stop('INITIAL_PUBLIC_SCHEMA_NOT_EMPTY_REQUIRES_PLAN')
            self.sql('DROP SCHEMA public RESTRICT;', administrator=True)
        self.run([self.args.client_bin / 'pg_restore', '--schema-only', '--schema=public',
                  '--single-transaction', '--exit-on-error', '--verbose', '-h', self.connection[0],
                  '-p', self.connection[1], '-U', 'supabase_admin', '-d', 'postgres', '--no-password', archive],
                 'PUBLIC_SCHEMA_RESTORE_FAILED')
        self.after_schema_restore()
        baseline = self.snapshot('baseline.json')
        self.summary['baseline_objects'] = {
            'tables': {t['name']: t['exists'] for t in baseline['tables']},
            'functions': {f['signature']: f['exists'] for f in baseline['functions']},
            'named_partner_trigger': any(t['name'] == 'partner_profiles_delete_reading_saves'
                for table in baseline['tables'] if table['name'] == 'partner_profiles'
                for t in table['triggers']),
        }
        self.summary['rehearsal_server_version'] = baseline['server_version']
        self.summary['rehearsal_extensions'] = [
            {k: extension[k] for k in ('name', 'version', 'schema')}
            for extension in baseline['extensions']]
        rollbacks = render(baseline, self.release)
        for name, text in rollbacks.items():
            (self.root / name).write_text(text)
        self.summary['checks'].append('public_schema_restore_and_baseline')

        self.stage('partial_data_scope_check')
        allowed = {'auth.users', *('public.' + table for table in TABLES)}
        if any(fk['parent'] not in allowed for fk in baseline['foreign_keys_to_partial_scope']):
            raise Stop('ADDITIONAL_PARENT_DATA_SCOPE_REQUIRES_APPROVAL')
        self.phase = 'COPY'
        datafile = self.root / 'private-four-table-data.sql'
        command = [self.args.client_bin / 'pg_restore', '--data-only', '--schema=public', '--file', datafile]
        command += [arg for name in TABLES for arg in ('--table', name)] + [archive]
        self.run(command, 'SCOPED_DATA_EXPORT_FAILED', data=True)
        copies, owners = parse_copy(datafile.read_text())
        order = copy_order(baseline['foreign_keys_to_partial_scope'])
        (self.root / 'private-ordered-copy.sql').write_text(ordered_copy_sql(copies, order))
        self.sql('begin;\n' + '\n'.join("INSERT INTO auth.users(id) VALUES ('" + owner + "'::uuid);" for owner in sorted(owners)) + '\ncommit;', administrator=True)
        # COPY must not replay application business events. FK/system triggers
        # remain active. Restore each user trigger to its exact original mode.
        restore_triggers = []
        for table in baseline['tables']:
            if table['name'] not in TABLES:
                continue
            for trigger in table['triggers']:
                if not trigger['internal']:
                    mode = {'O': 'ENABLE', 'D': 'DISABLE', 'R': 'ENABLE REPLICA', 'A': 'ENABLE ALWAYS'}[trigger['enabled']]
                    restore_triggers.append(f'ALTER TABLE public.{table["name"]} {mode} TRIGGER {qi(trigger["name"])};')
        wrapper = 'begin;\n' + '\n'.join('ALTER TABLE public.' + table + ' DISABLE TRIGGER USER;' for table in TABLES)
        wrapper += '\n\\ir private-ordered-copy.sql\n' + '\n'.join(restore_triggers) + '\ncommit;\n'
        copy_wrapper = self.root / 'private-copy-wrapper.sql'
        copy_wrapper.write_text(wrapper)
        self.sql(file=copy_wrapper, administrator=True)
        for table, copy in copies.items():
            columns = ','.join(qi(c) for c in copy['columns'])
            rows = copy_output_lines(self.sql(f"SET TIME ZONE 'UTC'; SET DateStyle='ISO'; COPY (SELECT {columns} FROM public.{table}) TO STDOUT;", administrator=True))
            metadata = next(t for t in baseline['tables'] if t['name'] == table)
            if len(rows) != len(copy['rows']) or row_digest(canonical_copy_rows(rows, copy['columns'], metadata)) != row_digest(canonical_copy_rows(copy['rows'], copy['columns'], metadata)):
                raise Stop('SCOPED_DATA_COUNT_OR_HASH_MISMATCH')
        self.summary['checks'].append('four_table_copy_and_hash_fk_active')
        self.phase = 'DDL'

        self.stage('apply_and_repeat')
        migrations = ['web_book_credits_20261017.sql', 'ai_book_questions_20261017.sql', 'reading_saves_20261017.sql']
        for index, name in enumerate(migrations):
            migration = self.release.parent / name
            self.sql(file=migration, extra=('--single-transaction',))
            once = self.snapshot(f'after-{index+1}.json')
            self.sql(file=migration, extra=('--single-transaction',), expect_failure=index == 1)
            twice = self.snapshot(f'repeated-{index+1}.json')
            if canonical(once) != canonical(twice):
                raise Stop('SECOND_APPLY_CHANGED_STRUCTURE')
        self.summary['checks'].append('three_apply_and_repeat')
        self.stage('partner_delete_trigger')
        self.sql(file=self.release / 'tests' / 'restored-partner-trigger.sql')
        self.summary['checks'].append('restored_partner_delete_trigger')
        self.stage('rollback')
        for name in reversed(list(rollbacks)):
            self.sql(file=self.root / name, extra=('--single-transaction', '-v', 'FATELAB_ROLLBACK_APPROVED=true'))
        after = self.snapshot('after-rollback.json')
        if canonical(baseline) != canonical(after):
            raise Stop('ROLLBACK_STRUCTURE_MISMATCH')
        self.summary['checks'].append('rollback_structure_identical')
        # Also verify the four restored data sets after the transactional tests.
        for table, copy in copies.items():
            columns = ','.join(qi(c) for c in copy['columns'])
            rows = copy_output_lines(self.sql(f"SET TIME ZONE 'UTC'; SET DateStyle='ISO'; COPY (SELECT {columns} FROM public.{table}) TO STDOUT;", administrator=True))
            metadata = next(t for t in baseline['tables'] if t['name'] == table)
            if row_digest(canonical_copy_rows(rows, copy['columns'], metadata)) != row_digest(canonical_copy_rows(copy['rows'], copy['columns'], metadata)):
                raise Stop('DATA_CHANGED_AFTER_ROLLBACK')
        self.summary['checks'].append('restored_data_unchanged_after_rollback')
        self.summary['status'] = 'SCOPED_REHEARSAL_OK'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--archive', type=Path, required=True)
    parser.add_argument('--attempt', type=Path, required=True)
    parser.add_argument('--cli', type=Path, required=True)
    parser.add_argument('--artifact-cache', type=Path, required=True)
    parser.add_argument('--client-bin', type=Path, default=Path('/opt/homebrew/opt/libpq/bin'))
    args = parser.parse_args()
    if not args.attempt.is_dir() or any(args.attempt.iterdir()):
        raise SystemExit('FRESH_EMPTY_ATTEMPT_REQUIRED')
    os.umask(0o077)
    runner = Rehearsal(args)
    try:
        runner.execute()
    except Exception as exc:
        runner.summary['status'] = str(exc) if isinstance(exc, Stop) else 'LOCAL_REHEARSAL_ERROR'
        with (runner.root / 'private-exception.log').open('w') as log:
            traceback.print_exc(file=log)
    finally:
        stopped = runner.stop()
        runner.summary['server_stopped'] = stopped
        if not stopped:
            runner.summary['status'] = 'LOCAL_SERVER_STOP_FAILED'
        (runner.root / 'summary.json').write_text(json.dumps(runner.summary, ensure_ascii=False, indent=2))
        print('RESULT=' + runner.summary['status'], flush=True)
    raise SystemExit(0 if runner.summary['status'] == 'SCOPED_REHEARSAL_OK' else 1)


if __name__ == '__main__':
    main()
