"""Disposable local Postgres only. Requires D02_COMPAT_PG_BIN; never reads DB URLs."""
import concurrent.futures, json, os, pathlib, subprocess, tempfile

base = pathlib.Path(__file__).resolve().parents[1]
binpath = pathlib.Path(os.environ['D02_COMPAT_PG_BIN']).resolve()
psql = os.environ.get('D01_PSQL', '/opt/homebrew/opt/libpq/bin/psql')
root = pathlib.Path(tempfile.mkdtemp(prefix='fatelab-d02-reconcile-', dir='/private/tmp'))
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


def uid(n): return f'{n:08d}-1111-4111-8111-111111111111'
def expect(condition, message):
    if not condition: raise AssertionError(message)
    print('PASS', message, flush=True)
def owner(query, n=1):
    return sql(f"set role authenticated; set request.jwt.claim.sub={literal(uid(n))}; " + query)
def save(op, p, n=1):
    return json.loads(owner(f"select save_reading_revision({literal(op)},{literal(json.dumps(p))}::jsonb,'test');", n))
def rejected(query, label, n=1):
    try: owner(query,n)
    except subprocess.CalledProcessError: print('PASS',label,flush=True); return
    raise AssertionError(label)
def service(name,args): return json.loads(sql(f"set role service_role; select {name}({','.join(args)});"))
def j(value): return literal(json.dumps(value))+'::jsonb'
def begin(op=100,n=1,worker=90,premium=False,source=None,partner=30,request=None):
    return service('begin_compatibility_operation',[literal(uid(n)),literal(uid(op)),literal(uid(worker)),literal(source or source_id),literal(uid(partner)),j(request or {'relationshipType':'friend'}),j({'commit':'synthetic'}),str(premium).lower()])
def status(op=100,n=1): return service('get_compatibility_operation',[literal(uid(n)),literal(uid(op))])
def fail(op=100,n=1,worker=90):return service('fail_compatibility_operation',[literal(uid(n)),literal(uid(op)),literal(uid(worker))])
def complete(op=100,n=1,worker=90,payload=None):
    return json.loads(owner(f"select complete_compatibility_operation('{uid(op)}','{uid(worker)}',{j(payload or result)},'synthetic');",n))
def balance():return int(sql(f"select balance from user_points where user_id='{uid(1)}';"))
try:
    command([str(binpath/'initdb'),'-D',str(cluster),'--no-locale','-A','trust','-U','postgres'])
    command([str(binpath/'pg_ctl'),'-D',str(cluster),'-l',str(root/'postgres.log'),'-o',f"-F -k {socket} -p 55472 -c listen_addresses=''",'-w','start']);started=True
    sql("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create table subscriptions(id uuid); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated;")
    sql((base.parents[1]/'supabase-reading-stripe.sql').read_text())
    sql((base.parents[1]/'supabase_migration.sql').read_text())
    for name in ['partner_profiles.sql','reading_conversation_bookmarks_build44.sql','reading_conversation_kind_chat_build55.sql','reading_revisions_d01.sql','compatibility_operations_d02.sql','compatibility_reconciliation_d02.sql']: sql((base/name).read_text())
    sql(f"insert into auth.users values('{uid(1)}'),('{uid(2)}'); grant select,insert,update,delete on reading_conversations to authenticated; insert into partner_profiles(id,user_id,display_name,birth_date,birthplace,gender,relationship_type) values('{uid(30)}','{uid(1)}','synthetic','2000-01-01','test','female','friend');")
    source_id=save('source',{'kind':'self','birthData':{'birthDate':'1990-01-01'},'calculatedData':{},'reportText':'self'})['id']
    report={'version':3,'reportText':'relationship','cards':[{'id':'synthetic'}],'unknownMetadata':{'keep':True}}
    result={'kind':'compatibility','partnerProfileId':uid(30),'birthData':{'self':{'birthDate':'1990-01-01'},'partner':{'name':'synthetic'}},'calculatedData':{'_structuredReport':report},'reportText':report['reportText']}
    expect(status()['state']=='not_found','missing operation can be distinguished')
    sql("create function reject_compat_insert() returns trigger language plpgsql as $$ begin raise exception 'injected_reservation_failure'; end $$; create trigger reject_compat_insert before insert on compatibility_operations for each row execute function reject_compat_insert();")
    try: begin()
    except subprocess.CalledProcessError: pass
    else: raise AssertionError('reservation failure was not injected')
    expect(balance()==3 and status()['state']=='not_found','reservation journal failure rolls back point debit')
    sql('drop trigger reject_compat_insert on compatibility_operations;')
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: starts=list(pool.map(lambda _:begin(),range(6)))
    expect(sum(x['state']=='started' for x in starts)==1 and balance()==0,'six concurrent requests reserve three points once')
    expect(starts[[x['state'] for x in starts].index('started')]['input']['self']['id']==source_id,'worker gets fixed source snapshot')
    sql(f"update partner_profiles set display_name='changed' where id='{uid(30)}';")
    expect(sql(f"select input_snapshot->'partner'->>'display_name' from compatibility_operations where op_id='{uid(100)}';")=='synthetic','profile edit cannot alter reserved input snapshot')
    expect(begin(request={'relationshipType':'romantic'})['state']=='conflict' and balance()==0,'changed payload cannot reuse reservation')
    expect(begin(op=101)['state']=='insufficient_points','separate operation cannot overspend')
    expect(status(n=2)['state']=='not_found','owner isolation on status')
    expect(begin(n=2)['state']=='source_not_found','foreign source rejected before points')
    expect(fail(worker=91)['state']=='pending' and balance()==0,'wrong worker cannot refund')
    expect(complete(worker=91)['state']=='pending','wrong worker cannot save')
    expect(complete(n=2)['state']=='not_found','foreign owner cannot save')
    invalid=dict(result,reportText='different')
    rejected(f"select complete_compatibility_operation('{uid(100)}','{uid(90)}',{j(invalid)},'bad');",'invalid report rejected before save')
    expect(status()['state']=='pending' and balance()==0,'invalid result keeps reservation reconcilable')
    sql("create function inject_compat_failure() returns trigger language plpgsql as $$ begin if new.state='completed' then raise exception 'injected_after_save'; end if; return new; end $$; create trigger inject_compat_failure before update on compatibility_operations for each row execute function inject_compat_failure();")
    count=sql('select count(*) from reading_revisions;')
    rejected(f"select complete_compatibility_operation('{uid(100)}','{uid(90)}',{j(result)},'test');",'injected completion journal failure rejects transaction')
    expect(sql('select count(*) from reading_revisions;')==count and sql("select count(*) from reading_conversations where kind='compatibility';")=='0','journal failure rolls back saved revision and conversation')
    sql('drop trigger inject_compat_failure on compatibility_operations;')
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: results=list(pool.map(lambda _:complete(),range(6)))
    done=results[0]
    expect(all(x==done for x in results) and done['state']=='completed','concurrent completions return one durable result')
    expect(done['result']==report and status()==done,'lost DONE is recoverable with exact metadata')
    expect(fail()==done and balance()==0,'late failure never refunds a committed result')
    expect(begin(premium=True)==done and balance()==0,'changed premium status cannot alter original charge')
    expect(sql('select count(*) from reading_conversations where kind=\'compatibility\';')=='1','one conversation is persisted')
    sql(f"update user_points set balance=3 where user_id='{uid(1)}';")
    expect(begin(op=102)['state']=='started' and balance()==0,'new paid reservation deducts once')
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: failures=list(pool.map(lambda _:fail(op=102),range(6)))
    expect(all(x['state']=='failed' for x in failures) and balance()==3,'six concurrent failures refund once')
    expect(sql(f"select total_earned from user_points where user_id='{uid(1)}';")=='3','refund does not inflate earned points')
    expect(begin(op=102)['state']=='failed','failed operation cannot restart and charge again')
    expect(begin(op=103,premium=True)['state']=='started' and balance()==3,'premium reservation never deducts')
    expect(fail(op=103)['state']=='failed' and balance()==3,'premium failure never adds points')
    begin(op=104)
    sql(f"update compatibility_operations set lease_until=clock_timestamp()-interval '1 second' where op_id='{uid(104)}';")
    expect(status(op=104)['state']=='failed' and balance()==3,'expiry refunds pending reservation once')
    expect(complete(op=104)['state']=='failed' and balance()==3,'expired worker cannot publish or charge')
    begin(op=105)
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(complete,105),pool.submit(fail,105)]; race=[f.result() for f in futures]
    end=status(op=105)
    expect(all(x['state']==end['state'] for x in race) and balance()==(0 if end['state']=='completed' else 3),'complete versus refund race has one consistent winner')
    owner(f"delete from reading_conversations where id='{done['conversationId']}';")
    expect(status()['state']=='deleted' and begin()['state']=='deleted','deleted result cannot be recreated by replay')
    sql(f"update user_points set balance=3 where user_id='{uid(1)}';")
    def sweep(apply=False,limit=100):return service('reconcile_compatibility_operations',[str(apply).lower(),str(limit)])
    def expire(*ops):sql("update compatibility_operations set lease_until=clock_timestamp()-interval '1 second' where op_id in ("+','.join(literal(uid(n)) for n in ops)+");")
    def lock_session(query):
        args=[psql,'-X','-qAt','-v','ON_ERROR_STOP=1','-h',str(socket),'-p','55472','-U','postgres','-d','postgres']
        process=subprocess.Popen(args,env=env,text=True,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        process.stdin.write("begin; "+query+"; select 'ready';\n");process.stdin.flush()
        while True:
            line=process.stdout.readline()
            if not line: raise AssertionError('lock session stopped')
            if line.strip()=='ready':return process
    def unlock(process):
        process.stdin.write('rollback;\n');process.stdin.flush();process.communicate(timeout=5)
        expect(process.returncode==0,'lock session closes cleanly')
    sql(f"update user_points set balance=30 where user_id='{uid(1)}';")
    for op in [200,201,203,204]:expect(begin(op=op)['state']=='started','reconciliation fixture reserves operation '+str(op))
    begin(op=202,premium=True);complete(op=204)
    expire(200,201,202)
    before=sql('select jsonb_agg(to_jsonb(c) order by op_id) from compatibility_operations c;')
    plan=sweep(limit=2)
    readonly=json.loads(sql('begin read only; set role service_role; select reconcile_compatibility_operations(false,2); commit;'))
    expect(readonly==plan,'preview runs inside a read-only database transaction')
    expect(plan=={'mode':'dry_run','examined':2,'wouldRefundPoints':6,'reconciled':0,'refundedPoints':0,'hasMore':True,'busy':False},'dry run previews bounded refund without applying')
    expect(balance()==18 and sql('select jsonb_agg(to_jsonb(c) order by op_id) from compatibility_operations c;')==before,'preview preserves balances and every operation field')
    locked=lock_session(f"select op_id from compatibility_operations where op_id='{uid(200)}' for update")
    try:
        swept=sweep(True)
        expect(swept['reconciled']==2 and swept['refundedPoints']==3 and swept['hasMore'] and balance()==21,'sweep skips locked operation and handles free plus paid expiry')
    finally:unlock(locked)
    expect(status(op=203)['state']=='pending' and status(op=204)['state']=='completed','active and completed operations remain untouched')
    expect(sweep(True)['refundedPoints']==3 and balance()==24,'next batch recovers previously locked reservation')
    expect(sweep(True)['reconciled']==0 and balance()==24,'repeated sweep does not refund twice')
    begin(op=205);expire(205)
    locked=lock_session("select pg_advisory_xact_lock(hashtextextended('compatibility-reconciliation',0))")
    try:expect(sweep(True)['busy'] and balance()==21,'operator lock returns busy without mutation')
    finally:unlock(locked)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: batches=list(pool.map(lambda _:sweep(True),range(6)))
    expect(sum(x['reconciled'] for x in batches)==1 and balance()==24,'six sweepers reconcile one operation once')
    begin(op=206);begin(op=207);expire(206,207)
    sql(f"create function reject_reconciliation() returns trigger language plpgsql as $$ begin if new.op_id='{uid(207)}' and new.state='failed' then raise exception 'injected_batch_failure'; end if; return new; end $$; create trigger reject_reconciliation before update on compatibility_operations for each row execute function reject_reconciliation();")
    try:sweep(True)
    except subprocess.CalledProcessError:pass
    else:raise AssertionError('batch failure was not injected')
    expect(balance()==18 and sql(f"select count(*) from compatibility_operations where op_id in ('{uid(206)}','{uid(207)}') and state='pending';")=='2','late batch failure rolls back all earlier refunds')
    sql('drop trigger reject_reconciliation on compatibility_operations;')
    limited=sweep(True,1)
    expect(limited['reconciled']==1 and limited['refundedPoints']==3 and limited['hasMore'] and balance()==21,'apply respects the requested one-operation limit')
    expect(sweep(True)['refundedPoints']==3 and balance()==24,'rolled-back batch can be safely retried in bounded parts')
    expect(sql(f"select total_earned from user_points where user_id='{uid(1)}';")=='3','sweeps never inflate earned points')
    for args in [['true','0'],['true','101'],['null','1']]:
        try:service('reconcile_compatibility_operations',args)
        except subprocess.CalledProcessError:pass
        else:raise AssertionError('invalid sweep options accepted')
    print('PASS invalid batch options rejected',flush=True)
    rejected('select reconcile_compatibility_operations(true,100);','ordinary user cannot invoke operator sweep')
    sql(f"update user_points set balance=3 where user_id='{uid(1)}';")
    begin(op=106)
    sql(f"delete from partner_profiles where id='{uid(30)}';")
    expect(status(op=106)['state']=='failed' and balance()==3,'partner deletion reconciles pending reservation')
    rejected(f"select begin_compatibility_operation('{uid(1)}','{uid(200)}','{uid(90)}','{source_id}','{uid(30)}','{{}}','{{}}',true);",'client cannot declare premium or reserve as another owner')
    rejected(f"select read_compatibility_operation('{uid(1)}','{uid(100)}');",'client cannot call private reconciliation helper')
    rejected('select * from compatibility_operations;','private inputs cannot be read directly')
    sql(f"delete from auth.users where id='{uid(1)}';")
    expect(sql('select count(*) from compatibility_operations;')=='0','account deletion removes operation inputs')
finally:
    if started: command([str(binpath/'pg_ctl'),'-D',str(cluster),'-m','fast','-w','stop'])
    print('Local cluster stopped:',root,flush=True)
