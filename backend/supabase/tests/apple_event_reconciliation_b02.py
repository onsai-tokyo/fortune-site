"""Disposable local Postgres only. Requires B02_PG_BIN; never reads DB URLs."""
import concurrent.futures, json, os, pathlib, subprocess, tempfile

base = pathlib.Path(__file__).resolve().parents[1]
binpath = pathlib.Path(os.environ['B02_PG_BIN']).resolve()
psql = os.environ.get('B02_PSQL', '/opt/homebrew/opt/libpq/bin/psql')
root = pathlib.Path(tempfile.mkdtemp(prefix='fatelab-b02-', dir='/private/tmp'))
cluster, socket = root / 'data', root / 'socket'
socket.mkdir(mode=0o700)
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
started = False

def command(args, **kwargs):
    result = subprocess.run(args, env=env, text=True, capture_output=True, **kwargs)
    if result.returncode:
        print(result.stderr, flush=True)
        result.check_returncode()
    return result.stdout.strip()

def sql(query):
    return command([psql, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1', '-h', str(socket), '-p', '55472', '-U', 'postgres', '-d', 'postgres'], input=query)

def literal(value):
    return "'" + str(value).replace("'", "''") + "'"

def receive(event_id, payload):
    return json.loads(sql(f"select public.app_store_receive_event({literal(payload['environment'])},{literal(event_id)},{literal(json.dumps(payload))}::jsonb);"))

def apply(event_id, env='Sandbox'):
    return json.loads(sql(f"select public.app_store_apply_event({literal(env)},{literal(event_id)});"))

def emit(event_id, payload):
    receive(event_id, payload)
    return apply(event_id, payload['environment'])

def uid(n): return f'{n:08d}-1111-4111-8111-111111111111'
def payload(original='line', transaction='t1', owner=1, purchase=1000000000000, signed=None, revoked=None, environment='Sandbox', request=None, transfer=False):
    return dict(environment=environment, action='transaction', requestUserId=uid(request) if request else None,
        allowOwnerTransfer=transfer, notificationType='SYNTHETIC_TEST', transaction=dict(environment=environment,
        originalTransactionId=original, transactionId=transaction, productId='synthetic.product', appAccountToken=uid(owner),
        purchaseMs=purchase, signedMs=signed or purchase+100, expiresMs=4102444800000, revokedMs=revoked, isUpgraded=False))

def expect(condition, message):
    if not condition: raise AssertionError(message)
    print('PASS', message, flush=True)

try:
    command([str(binpath/'initdb'), '-D', str(cluster), '--no-locale', '-A', 'trust', '-U', 'postgres'])
    command([str(binpath/'pg_ctl'), '-D', str(cluster), '-l', str(root/'postgres.log'), '-o', f"-F -k {socket} -p 55472 -c listen_addresses=''", '-w', 'start'])
    started = True
    sql('create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);')
    sql((base/'app_store_subscriptions_build45.sql').read_text())
    sql('insert into auth.users(id) values '+','.join(f'({literal(uid(n))})' for n in range(1,31))+';')
    # Preserve an actual legacy row through migration, without fabricated dates.
    sql(f"insert into public.app_store_subscriptions(user_id,original_transaction_id,latest_transaction_id,product_id,environment,subscription_status,app_account_token,expires_at) values('{uid(20)}','legacy','legacy-current','synthetic.product','Production','active','{uid(20)}',to_timestamp(4102444800000/1000.0));")
    sql((base/'apple_event_reconciliation_b02.sql').read_text())
    expect(sql("select purchase_ms is null and signed_ms is null from public.app_store_lineages where original_transaction_id='legacy';")=='t', 'legacy ordering remains unknown')
    expect(emit('new',payload(transaction='t2',purchase=1000000010000))['delivery']=='mirrored', 'new transaction applies')
    emit('old',payload())
    expect(sql("select latest_transaction_id from public.app_store_subscriptions where original_transaction_id='line';")=='t2', 'old renewal cannot roll back current transaction')
    emit('revoke',payload(transaction='t2',purchase=1000000010000,signed=1000000020000,revoked=1000000019000))
    emit('old-active',payload(transaction='t2',purchase=1000000010000,signed=1000000010100))
    expect(sql("select subscription_status from public.app_store_subscriptions where original_transaction_id='line';")=='revoked', 'older signed version cannot undo revoke/refund')
    emit('renew',payload(transaction='t3',purchase=1000000030000))
    emit('late-refund',payload(transaction='t2',purchase=1000000010000,signed=1000000040000,revoked=1000000019000))
    expect(sql("select latest_transaction_id||':'||subscription_status from public.app_store_subscriptions where original_transaction_id='line';")=='t3:active', 'late refund of previous transaction does not revoke new renewal')
    expect(apply('new')['delivery']=='mirrored', 'completed event replay acknowledges without replaying old writes')
    try:
        receive('new',payload(transaction='changed'))
        raise AssertionError('conflicting event accepted')
    except subprocess.CalledProcessError: print('PASS same event ID rejects changed payload',flush=True)
    # Receive is durable before apply; overlapping replays use a real DB lock.
    receive('parallel',payload(original='parallel',owner=2))
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        outcomes=list(pool.map(lambda _:apply('parallel'),range(6)))
    expect(all(x['delivery']=='mirrored' for x in outcomes), 'concurrent duplicate applications succeed once')
    expect(sql("select attempts from public.app_store_event_journal where event_id='parallel';")=='1','duplicate work has one applied attempt')
    # Inject a DB failure after lineage writes to verify subtransaction rollback.
    sql("create function public.fail_b02_test() returns trigger language plpgsql as $$ begin if new.original_transaction_id='failure' then raise exception 'synthetic_db_failure'; end if; return new; end $$; create trigger fail_b02_test before insert or update on public.app_store_subscriptions for each row execute function public.fail_b02_test();")
    failure=emit('failure',payload(original='failure',owner=3))
    expect(failure['state']=='pending' and sql("select count(*) from public.app_store_lineages where original_transaction_id='failure';")=='0','failed projection rolls back lineage but retains receipt')
    expect(sql("select state||':'||attempts from public.app_store_event_journal where event_id='failure';")=='failed:1','failure is retryable, not a completed duplicate')
    sql('drop trigger fail_b02_test on public.app_store_subscriptions; drop function public.fail_b02_test();')
    expect(apply('failure')['delivery']=='mirrored','same event succeeds after DB failure is resolved')
    emit('transfer-base',payload(original='transfer',owner=4))
    receive('older-transfer',payload(original='transfer',owner=4,request=5,transfer=True))
    expect(emit('newer-transfer',payload(original='transfer',owner=4,request=6,transfer=True))['ownerId']==uid(6),'explicit sandbox transfer applies atomically')
    expect(apply('older-transfer')['delivery']=='owner_mismatch','older queued transfer cannot reclaim ownership')
    emit('post-transfer-notification',payload(original='transfer',owner=4,transaction='transfer-renew',purchase=1000000020000))
    expect(sql("select user_id::text from public.app_store_lineages where original_transaction_id='transfer';")==uid(6),'later notification follows transferred owner, not old token')
    expect(sql(f"select count(*) from public.app_store_subscriptions where user_id='{uid(4)}';")=='0','old owner mirror removed in same transfer transaction')
    emit('production',payload(original='prod',owner=7,environment='Production'))
    expect(emit('prod-transfer',payload(original='prod',owner=7,environment='Production',request=8,transfer=True))['delivery']=='owner_mismatch','production transfer rejected even with caller flag')
    expect(emit('sandbox-prod',payload(original='sandbox-prod',owner=7))['state']=='pending','sandbox never overwrites production owner')
    expect(emit('legacy-old',payload(original='legacy',transaction='legacy-old',owner=20,environment='Production'))['reason']=='legacy_reconciliation_required','unknown legacy ordering blocks unrelated transaction')
    expect(emit('legacy-exact',payload(original='legacy',transaction='legacy-current',owner=20,environment='Production'))['delivery']=='mirrored','exact verified legacy transaction hydrates ordering')
    # Two different events, reverse arrival under simultaneous upsert.
    receive('race-old',payload(original='race',owner=9,transaction='race-old'))
    receive('race-new',payload(original='race',owner=9,transaction='race-new',purchase=1000000050000))
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool: list(pool.map(apply,['race-new','race-old']))
    expect(sql("select latest_transaction_id from public.app_store_subscriptions where original_transaction_id='race';")=='race-new','concurrent distinct notifications retain newest purchase')
    emit('refund-current',payload(original='reversal',owner=10,revoked=1000000000100,signed=1000000000200))
    emit('refund-reversed',payload(original='reversal',owner=10,signed=1000000000300))
    emit('refund-late',payload(original='reversal',owner=10,revoked=1000000000100,signed=1000000000200))
    expect(sql("select subscription_status from public.app_store_subscriptions where original_transaction_id='reversal';")=='active','newer refund reversal survives late refunded snapshot')
    emit('transfer-failure-base',payload(original='transfer-failure',owner=11))
    sql(f"create function public.fail_transfer_b02_test() returns trigger language plpgsql as $$ begin if new.user_id='{uid(12)}'::uuid then raise exception 'synthetic_transfer_failure'; end if; return new; end $$; create trigger fail_transfer_b02_test before insert or update on public.app_store_subscriptions for each row execute function public.fail_transfer_b02_test();")
    expect(emit('transfer-failure',payload(original='transfer-failure',owner=11,request=12,transfer=True))['state']=='pending','transfer target failure remains retryable')
    expect(sql("select user_id::text from public.app_store_subscriptions where original_transaction_id='transfer-failure';")==uid(11),'failed transfer restores original owner projection')
    expect(sql("select user_id::text from public.app_store_lineages where original_transaction_id='transfer-failure';")==uid(11),'failed transfer restores original lineage ownership')
    sql('drop trigger fail_transfer_b02_test on public.app_store_subscriptions; drop function public.fail_transfer_b02_test();')
    expect(apply('transfer-failure')['ownerId']==uid(12),'transfer retry commits both owner changes')
    receive('env-race-sandbox',payload(original='env-sandbox',owner=13))
    receive('env-race-production',payload(original='env-production',owner=13,environment='Production'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(lambda pair: apply(*pair), [('env-race-sandbox','Sandbox'),('env-race-production','Production')]))
    expect(sql(f"select environment from public.app_store_subscriptions where user_id='{uid(13)}';")=='Production','concurrent sandbox/production never leaves sandbox projection')
    no_owner=payload(original='no-owner',owner=14,request=14)
    no_owner['transaction']['appAccountToken']=None
    expect(emit('no-owner',no_owner)['reason']=='owner_unresolved','request user alone cannot claim an unowned receipt')
    expect(emit('transfer-again',payload(original='transfer',owner=4,request=5,transfer=True))['ownerId']==uid(5),'new explicit transfer intent can transfer back')
    expect(apply('newer-transfer')['delivery']=='owner_mismatch','old successful transfer cannot falsely acknowledge former owner')
    expect(sql("select has_function_privilege('authenticated','public.app_store_apply_event(text,text)','execute');")=='f','authenticated users cannot invoke journal writes')
    expect(sql("select has_table_privilege('service_role','public.app_store_subscriptions','update');")=='f','legacy direct mirror writer disabled')
    expect(sql("set role service_role; select count(*)>=1 from public.app_store_subscriptions;")=='t','service role retains entitlement read access')
    sql((base/'apple_event_reconciliation_b02_pause.sql').read_text())
    expect(sql("select has_function_privilege('service_role','public.app_store_apply_event(text,text)','execute');")=='f','operational pause disables only application RPC')
    paused=payload(original='paused',owner=15)
    sql(f"set role service_role; select public.app_store_receive_event('Sandbox','paused',{literal(json.dumps(paused))}::jsonb);")
    expect(sql("select state from public.app_store_event_journal where event_id='paused';")=='received','paused service can durably receive new events')
    sql('grant execute on function public.app_store_apply_event(text,text) to service_role;')
    result=json.loads(sql("set role service_role; select public.app_store_apply_event('Sandbox','paused');"))
    expect(result['delivery']=='mirrored','resume applies retained event under service role')
    print('ALL LOCAL POSTGRES CHECKS PASSED',root,flush=True)
finally:
    if started: command([str(binpath/'pg_ctl'), '-D', str(cluster), '-m', 'fast', '-w', 'stop'])
