"""Synthetic local PostgreSQL + real PostgREST + production Express router checks.

Never accepts database URLs or live credentials. FLOW_PG_BIN, FLOW_POSTGREST and
FLOW_PSQL select local executables only. Both empty and legacy databases are tested.
"""
import json, os, pathlib, re, socket, subprocess, tempfile, time, urllib.request

base = pathlib.Path(__file__).resolve().parents[1]
pg = pathlib.Path(os.environ['FLOW_PG_BIN']).resolve()
postgrest = pathlib.Path(os.environ['FLOW_POSTGREST']).resolve()
psql = os.environ.get('FLOW_PSQL', '/opt/homebrew/opt/libpq/bin/psql')
root = pathlib.Path(tempfile.mkdtemp(prefix='fatelab-flow-pgrst-', dir='/private/tmp'))
cluster, sockets = root / 'data', root / 'socket'
sockets.mkdir(mode=0o700)
env = {k: v for k, v in os.environ.items() if not k.startswith(('PG', 'PGRST_', 'SUPABASE_'))}
env.pop('ANTHROPIC_API_KEY', None)
secret = 'synthetic-only-local-postgrest-test-secret'
migrations = [
    'reading_revisions_d01.sql', 'self_generation_d02.sql',
    'question_operations_d02.sql', 'chat_creation_d02.sql',
    'compatibility_operations_d02.sql', 'compatibility_cancellation_d02.sql',
    'partner_registration_d02.sql', 'partner_registration_cancellation_d02.sql',
    'legacy_points_permissions_d02.sql', 'question_reconciliation_d02.sql',
    'compatibility_reconciliation_d02.sql',
]
started = False
rest = None


def command(args, **kwargs):
    result = subprocess.run(args, env=env, text=True, capture_output=True, **kwargs)
    if result.returncode:
        print(result.stdout, result.stderr, flush=True)
        result.check_returncode()
    return result.stdout.strip()


def sql(query, database='postgres'):
    return command([psql, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', str(sockets),
                    '-p', '55472', '-U', 'postgres', '-d', database], input=query)


def free_port():
    with socket.socket() as port:
        port.bind(('127.0.0.1', 0))
        return port.getsockname()[1]


try:
    print(command([str(postgrest), '--version']), flush=True)
    command([str(pg/'initdb'), '-D', str(cluster), '--no-locale', '--encoding=UTF8', '-A', 'trust', '-U', 'postgres'])
    command([str(pg/'pg_ctl'), '-D', str(cluster), '-l', str(root/'postgres.log'),
             '-o', f"-F -k {sockets} -p 55472 -c listen_addresses=''", '-w', 'start'])
    started = True
    sql('create role anon; create role authenticated; create role service_role bypassrls; '
        'create role authenticator login noinherit; grant anon,authenticated,service_role to authenticator;')
    for fixture in ['empty', 'legacy']:
        sql(f'create database {fixture};')
        def db(query): return sql(query, fixture)
        db("""
          create schema auth; create table auth.users(id uuid primary key);
          create table subscriptions(id uuid);
          create function auth.uid() returns uuid language sql stable as $$
            select nullif(current_setting('request.jwt.claims',true)::jsonb->>'sub','')::uuid
          $$;
          grant usage on schema auth,public to anon,authenticated,service_role;
          alter default privileges in schema public grant all on tables to anon,authenticated,service_role;
          alter default privileges in schema public grant all on sequences to anon,authenticated,service_role;
        """)
        for name in ['supabase-reading-stripe.sql', 'supabase_migration.sql',
                     'supabase-reading-sharing.sql', 'supabase-profile-traits.sql']:
            db((base.parents[1]/name).read_text())
        for name in ['partner_profiles.sql', 'reading_conversation_bookmarks_build44.sql',
                     'reading_conversation_kind_chat_build55.sql', 'partner_relationship_build45.sql',
                     'ai_chat_monthly_budget.sql', 'app_store_subscriptions_build45.sql']:
            db((base/name).read_text())
        # This FK is present in the shared schema; the original bootstrap omitted it.
        db('alter table reading_conversations add constraint reading_conversations_partner_profile_id_fkey '
           'foreign key(partner_profile_id) references partner_profiles(id) on delete set null;')
        if fixture == 'legacy':
            db("""
              insert into auth.users values('99999999-9999-4999-8999-999999999999');
              insert into reading_conversations(user_id,title,kind,report_text,birth_data,calculated_data)
                select '99999999-9999-4999-8999-999999999999','synthetic legacy',kind,'legacy preserved',
                       '{"unknownBirth":true}','{"unknownMetadata":{"preserve":true}}'
                from unnest(array['self','personal','compatibility','chat']) as kind;
            """)
        before = db("select coalesce(jsonb_agg(to_jsonb(c) order by id),'[]'::jsonb) from reading_conversations c;")
        # Validate the actual cutover as one transaction, including D01 backfill.
        parts = [re.sub(r'(?im)^(begin|commit);\s*$', '', (base/name).read_text()) for name in migrations]
        db('begin;\n' + '\n'.join(parts) + '\ncommit;')
        after = db("select coalesce(jsonb_agg(to_jsonb(c)-'reading_revision_id' order by id),'[]'::jsonb) from reading_conversations c;")
        assert before == after, 'Combined migration altered legacy fields'
        assert db('select count(*) from reading_conversations where reading_revision_id is null;') == '0'
        print(f'PASS {fixture}: 11 migrations commit together; legacy columns preserved', flush=True)
        db("insert into auth.users values('33333333-3333-4333-8333-333333333333'),('44444444-4444-4444-8444-444444444444');")
        port = free_port()
        config = root/f'{fixture}.conf'
        config.write_text(f'db-uri = "postgresql://authenticator@/{fixture}?host={sockets}&port=55472"\n'
                          f'db-schemas = "public"\ndb-anon-role = "anon"\njwt-secret = "{secret}"\n'
                          f'server-host = "127.0.0.1"\nserver-port = {port}\n')
        config.chmod(0o600)
        with (root/f'{fixture}-postgrest.log').open('w') as log:
            rest = subprocess.Popen([str(postgrest), str(config)], env=env, stdout=log, stderr=log)
            for attempt in range(100):
                if rest.poll() is not None: raise RuntimeError((root/f'{fixture}-postgrest.log').read_text())
                try:
                    with urllib.request.urlopen(f'http://127.0.0.1:{port}/', timeout=1) as response:
                        if response.status == 200: break
                except OSError: time.sleep(0.1)
            else: raise TimeoutError('Local PostgREST schema cache did not become ready')
            env['FLOW_TEST_REST'] = f'http://127.0.0.1:{port}'
            env['FLOW_TEST_SECRET'] = secret
            print(command(['node', '--import', 'tsx', 'src/scripts/testBasicFlowPostgrest.ts'], cwd=base.parent), flush=True)
            rest.terminate(); rest.wait(timeout=10); rest = None
        assert db("select count(*) from reading_messages where user_id='33333333-3333-4333-8333-333333333333';") == '2'
        print(f'PASS {fixture}: persisted exactly one question/answer pair after HTTP retries', flush=True)
    print('LIMIT: local PostgreSQL/PostgREST versions and synthetic data; not shared Supabase, iOS HTTP E2E or AI output acceptance', flush=True)
finally:
    if rest is not None:
        rest.terminate(); rest.wait(timeout=10)
    if started: command([str(pg/'pg_ctl'), '-D', str(cluster), '-m', 'fast', '-w', 'stop'])
    print('Local services stopped:', root, flush=True)
