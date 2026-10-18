"""Actual main book migrations + additive Web migration. Disposable, socket-only DB."""
import concurrent.futures, os, pathlib, subprocess, tempfile
base = pathlib.Path(__file__).resolve().parents[1]
binpath = pathlib.Path(os.environ['BOOKS_PG_BIN'])
root = pathlib.Path(tempfile.mkdtemp(prefix='fatelab-web-isolation-', dir='/private/tmp'))
cluster, socket = root/'data', root/'socket'
socket.mkdir()
env = {k:v for k,v in os.environ.items() if not k.startswith('PG')}
def command(args, **kwargs):
    p = subprocess.run(args, env=env, text=True, capture_output=True, **kwargs)
    if p.returncode: raise RuntimeError(p.stderr)
    return p.stdout.strip()
def sql(q):
    return command([str(binpath/'psql'), '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', str(socket), '-p', '55481', '-U', 'postgres', '-d', 'postgres'], input=q)
def uid(n): return f'{n:08d}-3333-4333-8333-333333333333'
def expect(c, label):
    if not c: raise AssertionError(label)
    print('PASS', label, flush=True)
def fails(q, code):
    try: sql(q)
    except RuntimeError as e: return code in str(e)
    return False
started = False
try:
    command([str(binpath/'initdb'), '-D', str(cluster), '--no-locale', '--encoding=UTF8', '-A', 'trust', '-U', 'postgres'])
    command([str(binpath/'pg_ctl'), '-D', str(cluster), '-l', str(root/'pg.log'), '-o', f"-F -k {socket} -p 55481 -c listen_addresses=''", '-w', 'start'])
    started = True
    # Minimal external Auth/Stripe/reading fixtures; book migrations below are the actual main files.
    sql('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz); create table public.reading_conversations(id uuid primary key,user_id uuid,kind text); create table public.stripe_subscriptions(user_id uuid,subscription_status text,current_period_end timestamptz);')
    for migration in ['app_store_subscriptions_build45.sql','apple_event_reconciliation_b02.sql','ai_books_20260927.sql','ai_books_review_credits_20261007.sql','ai_books_trial_20261008.sql','ai_books_device_trial_20261012.sql']:
        # Historical migrations are run ONLY on this fresh disposable local DB.
        sql((base/migration).read_text())
    original = sql("select md5(pg_get_functiondef('public.ai_book_order(uuid,uuid,uuid,text,text,text,jsonb)'::regprocedure));")
    first = (base/'web_book_credits_20261017.sql').read_text()
    sql(first)
    rules1 = sql("select conname,pg_get_constraintdef(oid,true) from pg_constraint where conrelid='public.ai_book_grants'::regclass and conname in ('ai_book_grants_source_check','ai_book_grants_environment_check') order by conname;")
    sql(first)
    rules2 = sql("select conname,pg_get_constraintdef(oid,true) from pg_constraint where conrelid='public.ai_book_grants'::regclass and conname in ('ai_book_grants_source_check','ai_book_grants_environment_check') order by conname;")
    expect(rules1 == rules2, 'second migration application does not duplicate predicates')
    expect(all(s in rules2 for s in ['signed_ms','transaction_id','quantity','review','trial','web']), 'original review/trial predicates remain')
    expect(original == sql("select md5(pg_get_functiondef('public.ai_book_order(uuid,uuid,uuid,text,text,text,jsonb)'::regprocedure));"), 'iOS order function is byte-identical after both applications')
    owner, other, source = uid(1), uid(2), uid(90)
    sql(f"insert into auth.users(id) values ('{owner}'),('{other}'); insert into public.reading_conversations values ('{source}','{owner}','self'); update public.ai_book_settings set enabled=true;")
    sql(f"insert into public.ai_book_grants(user_id,environment,transaction_id,source,quantity,starts_at,expires_at,revoked,signed_ms) values ('{other}','Sandbox','admin-review:fixture','review',1,now(),null,false,0),('{other}','Production','trial:fixture','trial',1,now(),now()+interval '1 day',false,0);")
    expect(sql("select count(*) from public.ai_book_grants where source in ('review','trial');") == '2', 'valid review and trial grants remain accepted after both applications')
    expect(fails(f"insert into public.ai_book_grants(user_id,environment,transaction_id,source,quantity,starts_at,revoked,signed_ms) values ('{other}','Production','admin-review:invalid','review',1,now(),false,0);", 'ai_book_grants_source_check'), 'invalid review environment remains rejected')
    sql(f"select public.ai_book_grant_web('{owner}','fixture-web',2);")
    def order(op, who=owner, src=source): return f"select public.ai_book_order_web('{who}','{op}','{src}','本人','仕事','自分に合う仕事の進め方を詳しく知りたいです。','[]');"
    ios_order = f"select public.ai_book_order('{owner}','{uid(200)}','{source}','本人','仕事','自分に合う仕事の進め方を詳しく知りたいです。','[]');"
    expect(fails(ios_order,'BOOK_MEMBERSHIP_REQUIRED'), 'Web credits do not bypass iOS non-member rule')
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        books = list(pool.map(lambda _: sql(order(uid(100))), range(4)))
    expect(len(set(books)) == 1, 'concurrent Web operation consumes exactly one credit')
    expect(sql("select count(*) from public.ai_book_credits where consumed_by is not null;") == '1', 'one consumed credit')
    expect(fails(order(uid(101),other),'BOOK_SOURCE'), 'another owner cannot order from this source')
    sql(order(uid(102)))
    expect(fails(order(uid(103)),'BOOK_NO_CREDITS'), 'no third order after two Web credits')
    expect(sql("select count(*) from public.ai_books where funding_source='web';") == '2', 'only Web-funded orders created')
    other_source = uid(91)
    sql(f"insert into public.reading_conversations values ('{other_source}','{other}','self'); insert into public.stripe_subscriptions values ('{other}','active',now()+interval '1 day'); select public.ai_book_grant('{other}','Sandbox','fixture-apple','purchase',now()-interval '1 day',null,false,1);")
    expect(fails(order(uid(104),other,other_source),'BOOK_NO_CREDITS'), 'Web order cannot consume a member Apple purchase or review/trial grant')
    result = sql(f"select public.ai_book_order('{other}','{uid(105)}','{other_source}','本人','仕事','自分に合う仕事の進め方を詳しく知りたいです。','[]');")
    expect(bool(result), 'existing iOS member order still succeeds after the Web migration')
    expect(sql("select has_function_privilege('authenticated','public.ai_book_order_web(uuid,uuid,uuid,text,text,text,jsonb)','EXECUTE');") == 'f', 'Web order RPC is service-only')
    print('ALL MAIN / WEB BOOK ISOLATION CHECKS PASSED', flush=True)
finally:
    if started: command([str(binpath/'pg_ctl'), '-D', str(cluster), '-m', 'immediate', '-w', 'stop'])
