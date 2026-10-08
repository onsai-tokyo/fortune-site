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
def sql(q):return command(['/opt/homebrew/opt/libpq/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',str(socket),'-p','55479','-U','postgres','-d','postgres'],input=q)
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
    command([str(binpath/'pg_ctl'),'-D',str(cluster),'-l',str(root/'pg.log'),'-o',f"-F -k {socket} -p 55479 -c listen_addresses=''",'-w','start']);started=True
    sql('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);')
    sql((base/'app_store_subscriptions_build45.sql').read_text())
    sql((base/'apple_event_reconciliation_b02.sql').read_text())
    sql((base/'ai_books_20260927.sql').read_text())
    sql('insert into auth.users values '+','.join(f"('{uid(n)}')" for n in range(1,8))+';')
    expect(sql('select enabled from public.ai_book_settings;')=='f','feature defaults off')
    sql('update public.ai_book_settings set enabled=true;')
    # Exercise the actual verified-event journal integration, not only the grant helper.
    import time
    now=int(time.time()*1000)
    def event(tx,purchase,expiry):
        return dict(environment='Sandbox',action='transaction',requestUserId=uid(1),allowOwnerTransfer=False,notificationType=None,transaction=dict(environment='Sandbox',originalTransactionId='line1',transactionId=tx,productId='synthetic.product',appAccountToken=uid(1),purchaseMs=purchase,signedMs=purchase+1,expiresMs=expiry,revokedMs=None,isUpgraded=False))
    def emit(name,payload):
        sql(f"select public.app_store_receive_event('Sandbox',{lit(name)},{lit(json.dumps(payload))}::jsonb);")
        return json.loads(sql(f"select public.app_store_apply_event('Sandbox',{lit(name)});"))
    payload=event('first',now-10000,now+86400000)
    expect(emit('first-event',payload)['delivery']=='mirrored','first purchase journals successfully')
    emit('first-event',payload);sql(f"select public.ai_book_sync_member('{uid(1)}');")
    expect(sql('select count(*) from public.ai_book_credits;')=='3','first period grants exactly three despite duplicate + sync')
    a=order(100)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool: results=list(pool.map(lambda _:order(100),range(5)))
    expect(all(x==a for x in results),'concurrent operation retry creates one book')
    expect(sql('select count(*) from public.ai_book_credits where consumed_by is not null;')=='1','one credit consumed on retries')
    try:order(100,question='別の相談内容を同じ受付番号で送信するとどうなるのでしょうか。');raise AssertionError('conflict accepted')
    except RuntimeError as e:expect('BOOK_OPERATION_CONFLICT' in str(e),'changed request under same operation rejected')
    def tryorder(n):
        try:return order(n)
        except RuntimeError as e:return 'NO_CREDITS' if 'BOOK_NO_CREDITS' in str(e) else str(e)
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:result=list(pool.map(tryorder,range(101,106)))
    expect(result.count('NO_CREDITS')==3,'parallel different orders cannot overdraw two remaining credits')
    b=claim();expect(b['id']==a,'worker claims oldest order')
    expect(sql(f"select public.ai_book_finish('{a}','{uid(900)}','{{}}','{{}}');")=='f','stale lease cannot publish')
    expect(sql(f"select public.ai_book_fail('{a}','{b['lease_id']}');")=='t','generation failure returns credit')
    expect(sql(f"select public.ai_book_fail('{a}','{b['lease_id']}');")=='f','failure replay cannot return twice')
    expect(sql('select count(*) from public.ai_book_credits where consumed_by is null;')=='1','exactly one credit returned')
    order(106)
    # Expire prior period and renew; previous unused slots never carry forward.
    sql("update public.ai_book_grants set expires_at=now()-interval '1 second';")
    emit('renewal-event',event('renewal',now-1000,now+172800000))
    expect(sql("select count(*) from public.ai_book_credits c join public.ai_book_grants g on g.id=c.grant_id where g.transaction_id='renewal';")=='3','renewal grants exactly three')
    # Permanent purchased credit and revocation replay protection.
    grant('single','purchase',owner=2,end='null');grant('single','purchase',owner=2,end='null')
    expect(sql("select count(*) from public.ai_book_credits c join public.ai_book_grants g on g.id=c.grant_id where g.user_id='"+uid(2)+"';")=='1','single purchase duplicate grants once')
    grant('single','purchase',owner=2,end='null',revoked='true',signed=200);grant('single','purchase',owner=2,end='null',signed=100)
    try:order(201,owner=2);raise AssertionError('refunded credit usable')
    except RuntimeError as e:expect('BOOK_NO_CREDITS' in str(e),'revocation survives older signed replay')
    grant('period-old',owner=3,end="now()-interval '1 second'")
    try:order(301,owner=3);raise AssertionError('expired credit usable')
    except RuntimeError as e:expect('BOOK_NO_CREDITS' in str(e),'expired member credits unusable')
    grant('single3','purchase',owner=3,end='null');order(302,owner=3)
    sql(f"select public.ai_book_cancel_unsubmitted('{uid(3)}','{uid(303)}');")
    try:order(303,owner=3);raise AssertionError('cancelled request accepted')
    except RuntimeError as e:expect('BOOK_CANCELLED' in str(e),'delayed submission cannot commit after cancellation')
    expect(sql(f"select public.ai_book_cancel_unsubmitted('{uid(1)}','{uid(100)}');")==a,'cancellation discovers an already accepted book')
    # Review mode withholds until explicit approval; queue restart is recoverable.
    b=claim();sql(f"select public.ai_book_finish('{b['id']}','{b['lease_id']}','{{\"title\":\"確認用の本\"}}','{{}}');")
    expect(sql(f"select state from public.ai_books where id='{b['id']}';")=='review','review mode does not deliver immediately')
    expect(sql(f"select public.ai_book_review('{b['id']}',true);")=='t','approval delivers')
    b=claim();sql(f"update public.ai_books set lease_until=now()-interval '1 second' where id='{b['id']}';")
    recovered=claim();expect(recovered['id']==b['id'] and recovered['lease_id']!=b['lease_id'],'expired lease recovers same job')
    sql(f"update public.ai_books set attempts=3,lease_until=now()-interval '1 second' where id='{b['id']}';")
    claim();expect(sql(f"select state from public.ai_books where id='{b['id']}';")=='failed','three attempts stop with returned credit')
    try:sql("set role authenticated;select public.ai_book_grant('"+uid(1)+"','Sandbox','forged','purchase',now(),null,false,1);");raise AssertionError('client grant allowed')
    except RuntimeError as e:expect('permission denied' in str(e),'client cannot mint credits')
    try:sql('set role authenticated;select * from public.ai_books;');raise AssertionError('direct access allowed')
    except RuntimeError as e:expect('permission denied' in str(e),'client cannot read other accounts directly')
    sql(f"delete from auth.users where id='{uid(3)}';")
    expect(sql(f"select count(*) from public.ai_books where user_id='{uid(3)}';")=='0','account deletion cascades to books')
    # New trial migration: identity verification, concurrent grants, atomic spend and refunds.
    sql("alter table auth.users add column email text, add column email_confirmed_at timestamptz;")
    sql((base/'ai_books_trial_20261008.sql').read_text())
    sql(f"update auth.users set email='trial@example.invalid',email_confirmed_at=now() where id='{uid(4)}';")
    def trial(owner=4):return sql(f"select public.ai_book_sync_trial('{uid(owner)}');")
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(lambda _:trial(),range(4)))
    expect(sql(f"select count(*) from public.ai_book_grants where user_id='{uid(4)}' and source='trial';")=='1','concurrent trial requests grant exactly one credit')
    def trial_order(n):
        try:return order(n,owner=4)
        except RuntimeError as e:
            if 'BOOK_NO_CREDITS' in str(e):return None
            raise
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(trial_order,[401,402]))
    expect(sum(x is not None for x in results)==1,'two simultaneous orders cannot spend one trial twice')
    trialbook=next(x for x in results if x)
    sql(f"update ai_books set state='generating',lease_id='{uid(800)}' where id='{trialbook}'; select ai_book_fail('{trialbook}','{uid(800)}');")
    expect(bool(order(403,owner=4)),'failed trial returns a usable credit')
    sql(f"delete from auth.users where id='{uid(4)}'; update auth.users set email='TRIAL@example.invalid',email_confirmed_at=now() where id='{uid(5)}';")
    trial(5)
    expect(sql(f"select count(*) from ai_book_grants where user_id='{uid(5)}';")=='0','re-registration with same verified email cannot reclaim trial')
    sql(f"update auth.users set email='unverified@example.invalid' where id='{uid(6)}';")
    trial(6)
    expect(sql(f"select count(*) from ai_book_grants where user_id='{uid(6)}';")=='0','unverified email cannot claim trial')
    sql(f"update auth.users set email='member-trial@example.invalid',email_confirmed_at=now() where id='{uid(7)}';")
    grant('member-trial',owner=7);trial(7);first=order(701,owner=7)
    expect(sql(f"select g.source from ai_book_credits c join ai_book_grants g on g.id=c.grant_id where c.consumed_by='{first}';")=='trial','first free credit is spent before monthly credits')
    for query in [f"select ai_book_sync_trial('{uid(7)}');",'select * from ai_book_trial_secret;','select * from ai_book_trial_claims;']:
        try:sql('set role authenticated;'+query);raise AssertionError('trial authority exposed')
        except RuntimeError as e:expect('permission denied' in str(e),'trial minting and fingerprints are not client-accessible')
    print('ALL BOOK DATABASE CHECKS PASSED',flush=True)
finally:
    if started:command([str(binpath/'pg_ctl'),'-D',str(cluster),'-m','immediate','-w','stop'])
