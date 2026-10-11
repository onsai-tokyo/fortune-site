"""Disposable PostgreSQL tests; no dotenv or production connection URLs are read."""
import concurrent.futures,json,os,pathlib,subprocess,tempfile
base=pathlib.Path(__file__).resolve().parents[1]
binpath=pathlib.Path(os.environ['BOOKS_PG_BIN'])
root=pathlib.Path(tempfile.mkdtemp(prefix='fatelab-books-db-',dir='/private/tmp'))
cluster=root/'data'; socket=root/'socket';socket.mkdir()
env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
def command(args,**kwargs):
    p=subprocess.run(args,env=env,text=True,capture_output=True,**kwargs)
    if p.returncode: raise RuntimeError(p.stderr)
    return p.stdout.strip()
def sql(q):return command(['/opt/homebrew/opt/libpq/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',str(socket),'-p','55481','-U','postgres','-d','postgres'],input=q)
def lit(x):return "'"+str(x).replace("'","''")+"'"
def uid(n):return f'{n:08d}-1111-4111-8111-111111111111'
def expect(c,m):
    if not c:raise AssertionError(m)
    print('PASS',m,flush=True)
def grant(tx,source='member',owner=1,end="now()+interval '30 days'",revoked='false',signed=100):
    sql(f"select public.ai_book_grant('{uid(owner)}','Sandbox','{tx}','{source}',now()-interval '1 day',{end},{revoked},{signed});")
def order(n,owner=1,question='相手とすれ違う時にどんな伝え方を試せばいいでしょうか。'):
    return sql(f"select public.ai_book_order('{uid(owner)}','{uid(n)}','{uid(99)}','ふたりの鑑定','恋愛・関係',{lit(question)},'[]');")
def claim():return json.loads(sql('select public.ai_book_claim();') or 'null')
started=False
try:
    command([str(binpath/'initdb'),'-D',str(cluster),'--no-locale','--encoding=UTF8','-A','trust','-U','postgres'])
    command([str(binpath/'pg_ctl'),'-D',str(cluster),'-l',str(root/'pg.log'),'-o',f"-F -k {socket} -p 55481 -c listen_addresses=''",'-w','start']);started=True
    sql('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);')
    sql((base/'app_store_subscriptions_build45.sql').read_text())
    sql((base/'apple_event_reconciliation_b02.sql').read_text())
    sql((base/'ai_books_20260927.sql').read_text())
    sql((base/'ai_books_annual_20261011.sql').read_text())
    sql((base/'ai_books_sandbox_transfer_20261012.sql').read_text())
    sql("insert into auth.users values ('"+uid(1)+"'); update public.ai_book_settings set enabled=true;")
    def annual(revoked=False,signed=200):
        tx={'transactionId':'annual-test','productId':'com.onsai.fatelab.premium.annual','purchaseMs':1769817600000,'expiresMs':1801353600000,'signedMs':signed,'isUpgraded':False}
        if revoked:tx['revokedMs']=1770000000000
        sql(f"select public.ai_book_apply_subscription('{uid(1)}','Production',{lit(json.dumps(tx))}::jsonb)")
    annual();annual()
    expect(sql('select count(*) from public.ai_book_grants')=='12','annual replay creates exactly 12 windows')
    expect(sql('select count(*) from public.ai_book_credits')=='60','annual schedules 12 times five credits')
    expect(sql("select count(*) from public.ai_book_credits c join public.ai_book_grants g on g.id=c.grant_id where starts_at<='2026-02-28 00:00Z' and expires_at>'2026-02-28 00:00Z'")=='5','month end boundary has exactly five usable credits')
    expect(sql("select bool_and(quantity=5) from public.ai_book_grants")=='t','each annual month grants five')
    expect(sql("select count(*) from public.ai_book_grants a join public.ai_book_grants b on a.id<>b.id and tstzrange(a.starts_at,a.expires_at,'[)') && tstzrange(b.starts_at,b.expires_at,'[)')")=='0','annual windows never overlap')
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool: list(pool.map(lambda _:annual(),range(4)))
    expect(sql('select count(*) from public.ai_book_credits')=='60','concurrent annual sync is idempotent')
    sql('update public.ai_book_settings set enabled=false')
    annual(True,300);annual(False,200)
    sql('update public.ai_book_settings set enabled=true')
    expect(sql('select count(*) from public.ai_book_grants where not revoked')=='0','refund revokes all future months and old replay cannot restore')
    sql(f"select public.ai_book_apply_subscription('{uid(1)}','Sandbox',"+lit(json.dumps({'transactionId':'monthly','productId':'monthly','purchaseMs':1769817600000,'expiresMs':1772236800000,'signedMs':300}))+"::jsonb)")
    expect(sql("select quantity from public.ai_book_grants where transaction_id='monthly'")=='3','monthly remains three credits')
    now=int(sql("select (extract(epoch from now())*1000)::bigint"))
    tx={'transactionId':'switchAnnual','originalTransactionId':'lineage','productId':'com.onsai.fatelab.premium.annual','purchaseMs':now,'expiresMs':now+365*86400000,'signedMs':now,'isUpgraded':False}
    grant('old-monthly',end="now()+interval '30 days'",signed=now-100)
    sql(f"insert into public.app_store_subscriptions(user_id,original_transaction_id,latest_transaction_id,product_id,environment,subscription_status,expires_at,app_account_token) values('{uid(1)}','lineage','switchAnnual','com.onsai.fatelab.premium.annual','Production','active',now()+interval '1 year','{uid(1)}')")
    sql(f"select public.ai_book_apply_subscription('{uid(1)}','Production',{lit(json.dumps(tx))}::jsonb)")
    expect(sql("select count(*) from public.ai_book_credits c join public.ai_book_grants g on g.id=c.grant_id where not revoked and starts_at<=now() and expires_at>now()")=='5','switch to annual immediately leaves five usable member credits')
    sql(f"insert into auth.users values ('{uid(2)}'),('{uid(3)}')")
    tx={'environment':'Sandbox','transactionId':'transferAnnual','originalTransactionId':'sandbox-line','productId':'com.onsai.fatelab.premium.annual','appAccountToken':uid(2),'purchaseMs':now-1000,'expiresMs':now+86400000,'signedMs':now,'revokedMs':None,'isUpgraded':False}
    def emit(key,owner):
        payload={'environment':'Sandbox','action':'transaction','requestUserId':uid(owner),'allowOwnerTransfer':True,'transaction':tx}
        sql(f"select public.app_store_receive_event('Sandbox',{lit(key)},{lit(json.dumps(payload))}::jsonb)")
        return sql(f"select public.app_store_apply_event('Sandbox',{lit(key)})")
    emit('transfer-start',2)
    order(201,owner=2)
    emit('transfer-move',3)
    expect(sql(f"select count(*) from public.ai_book_grants where user_id='{uid(3)}'")=='12','sandbox transfer moves annual windows')
    expect(sql(f"select count(*) from public.ai_book_credits c join public.ai_book_grants g on g.id=c.grant_id where g.user_id='{uid(3)}' and consumed_by is not null")=='1','transfer preserves consumed slot')
    expect(sql(f"select count(*) from public.ai_book_credits c join public.ai_book_grants g on g.id=c.grant_id where g.user_id='{uid(3)}' and not revoked and starts_at<=now() and expires_at>now() and consumed_by is null")=='4','transfer leaves four unused slots')
    sql(f"select public.ai_book_sync_member('{uid(3)}')")
    expect(sql(f"select count(*) from public.ai_book_credits c join public.ai_book_grants g on g.id=c.grant_id where g.user_id='{uid(3)}'")=='60','repeat sync cannot duplicate slots')
    sql(f"update public.ai_book_grants set user_id='{uid(2)}',revoked=true where transaction_id like 'transferAnnual:%'")
    sql(f"select public.ai_book_sync_member('{uid(3)}')")
    expect(sql(f"select count(*) from public.ai_book_credits c join public.ai_book_grants g on g.id=c.grant_id where g.user_id='{uid(3)}' and not revoked and starts_at<=now() and expires_at>now() and consumed_by is null")=='4','legacy broken transfer is repaired without replenishment')
    tx['revokedMs']=now+1;tx['signedMs']=now+2
    emit('transfer-refund',3)
    sql(f"select public.ai_book_sync_member('{uid(3)}')")
    expect(sql("select count(*) from public.ai_book_grants where transaction_id like 'transferAnnual:%' and not revoked")=='0','refund stays revoked after sync')
finally:
    if started: command([str(binpath/'pg_ctl'),'-D',str(cluster),'-m','immediate','-w','stop'])
