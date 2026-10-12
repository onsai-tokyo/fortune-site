"""Disposable local PostgreSQL/PostgREST. No live URLs, keys, Apple or AI calls."""
import os,pathlib,subprocess,tempfile,socket,time,urllib.request
base=pathlib.Path(__file__).resolve().parents[1]
pg=pathlib.Path(os.environ['BOOKS_PG_BIN']);restbin=os.environ['BOOKS_POSTGREST']
root=pathlib.Path(tempfile.mkdtemp(prefix='fatelab-books-http-',dir='/private/tmp'))
cluster=root/'data';sockets=root/'socket';sockets.mkdir()
env={k:v for k,v in os.environ.items() if not k.startswith(('PG','PGRST_','SUPABASE_','ANTHROPIC_','AI_BOOK_','DEVICECHECK_','APP_STORE_','APPLE_'))}
env['DOTENV_CONFIG_PATH']='/nonexistent-synthetic-env'
def command(args,**kwargs):
    p=subprocess.run(args,env=env,text=True,capture_output=True,**kwargs)
    if p.returncode:raise RuntimeError(p.stdout+'\n'+p.stderr)
    return p.stdout.strip()
def sql(q):return command(['/opt/homebrew/opt/libpq/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',str(sockets),'-p','55480','-U','postgres'],input=q)
started=False;rest=None
try:
    command([str(pg/'initdb'),'-D',str(cluster),'--no-locale','--encoding=UTF8','-A','trust','-U','postgres'])
    command([str(pg/'pg_ctl'),'-D',str(cluster),'-l',str(root/'postgres.log'),'-o',f"-F -k {sockets} -p 55480 -c listen_addresses=''",'-w','start']);started=True
    sql('create role anon;create role authenticated;create role service_role bypassrls;create role authenticator login noinherit;grant anon,authenticated,service_role to authenticator;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create table public.stripe_subscriptions(user_id uuid primary key references auth.users(id),subscription_status text,current_period_end timestamptz);grant select on stripe_subscriptions to service_role;grant usage on schema public to anon,authenticated,service_role;')
    for name in ['app_store_subscriptions_build45.sql','apple_event_reconciliation_b02.sql','ai_books_20260927.sql']:
        sql((base/name).read_text())
    patch=base/'ai_books_pause_refunds_20260927.sql'
    if os.environ.get('BOOKS_TEST_PATCH','1')=='1':sql(patch.read_text())
    for name in ['ai_books_trial_20261008.sql','ai_books_trial_member_limit_20261009.sql','ai_books_annual_20261011.sql','product_events_20261012.sql','ai_book_usage_20261012.sql','ai_books_device_trial_20261012.sql']:
        sql((base/name).read_text())
    sql("insert into auth.users(id,email,email_confirmed_at) values('33333333-3333-4333-8333-333333333333','member@example.invalid',now()),('44444444-4444-4444-8444-444444444444','trial@example.invalid',now()),('55555555-5555-4555-8555-555555555555','capped@example.invalid',now());create table reading_conversations(id uuid primary key,user_id uuid references auth.users(id),title text,kind text,report_text text,calculated_data jsonb,birth_data jsonb,partner_profile_id uuid,reading_revision_id uuid);alter table reading_conversations enable row level security;grant all on reading_conversations to service_role;")
    with socket.socket() as s:s.bind(('127.0.0.1',0));port=s.getsockname()[1]
    config=root/'rest.conf';config.write_text(f'db-uri = "postgresql://authenticator@/postgres?host={sockets}&port=55480"\ndb-schemas = "public"\ndb-anon-role = "anon"\njwt-secret = "synthetic-only-local-postgrest-test-secret"\nserver-host = "127.0.0.1"\nserver-port = {port}\n')
    with (root/'rest.log').open('w') as log:
        rest=subprocess.Popen([restbin,str(config)],env=env,stdout=log,stderr=log)
        for _ in range(100):
            if rest.poll() is not None:raise RuntimeError((root/'rest.log').read_text())
            try:
                with urllib.request.urlopen(f'http://127.0.0.1:{port}/',timeout=1):break
            except OSError:time.sleep(.1)
        else:raise TimeoutError('PostgREST startup')
        env['BOOK_TEST_REST']=f'http://127.0.0.1:{port}'
        print(command(['node','--import','tsx','src/scripts/testBooksPostgrest.ts'],cwd=base.parent),flush=True)
        exec(compile((base/'tests/baseline_report_cases.py').read_text(),str(base/'tests/baseline_report_cases.py'),'exec'))
finally:
    if rest is not None:rest.terminate();rest.wait(timeout=10)
    if started:command([str(pg/'pg_ctl'),'-D',str(cluster),'-m','fast','-w','stop'])
    print('Stopped local services:',root,flush=True)
