"""Disposable local Postgres only. Requires D02_COMPAT_PG_BIN; never reads DB URLs."""
import concurrent.futures, json, os, pathlib, subprocess, tempfile

base = pathlib.Path(__file__).resolve().parents[1]
binpath = pathlib.Path(os.environ['D02_COMPAT_PG_BIN']).resolve()
psql = os.environ.get('D01_PSQL', '/opt/homebrew/opt/libpq/bin/psql')
root = pathlib.Path(tempfile.mkdtemp(prefix='fatelab-d02-compat-', dir='/private/tmp'))
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
    command([str(binpath/'initdb'),'-D',str(cluster),'--no-locale','--encoding=UTF8','-A','trust','-U','postgres'])
    command([str(binpath/'pg_ctl'),'-D',str(cluster),'-l',str(root/'postgres.log'),'-o',f"-F -k {socket} -p 55472 -c listen_addresses=''",'-w','start']);started=True
    sql("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create table subscriptions(id uuid); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated;")
    sql((base.parents[1]/'supabase-reading-stripe.sql').read_text())
    sql((base.parents[1]/'supabase_migration.sql').read_text())
    for name in ['partner_profiles.sql','reading_conversation_bookmarks_build44.sql','reading_conversation_kind_chat_build55.sql','reading_revisions_d01.sql','compatibility_operations_d02.sql','compatibility_cancellation_d02.sql','partner_relationship_build45.sql','partner_registration_d02.sql','partner_registration_cancellation_d02.sql','legacy_points_permissions_d02.sql']: sql((base/name).read_text())
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
    begin(op=106)
    def cancel(op,n=1): return service('cancel_unstarted_compatibility_operation',[literal(uid(n)),literal(uid(op))])
    before=balance()
    expect(cancel(300)['state']=='failed' and status(300)['state']=='failed','unstarted cancellation creates a durable terminal status')
    expect(begin(300)['state']=='failed' and balance()==before,'delayed begin after cancellation cannot debit points')
    expect(cancel(300,n=2)['state']=='failed' and status(300,n=2)['state']=='failed','same operation ID is isolated by owner')
    expect(cancel(106)['state']=='pending' and balance()==before,'active reservation cannot be discarded by cancellation')
    expect(cancel(100)['state']=='deleted','cancel preserves deleted completed result')
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: cancelled=list(pool.map(lambda _:cancel(301),range(6)))
    expect(all(x['state']=='failed' for x in cancelled) and balance()==before,'six cancellations create one tombstone without refund')
    expect(sql(f"select count(*) from compatibility_cancellations where user_id='{uid(1)}' and op_id='{uid(301)}';")=='1','cancellation retry is idempotent')
    # Premium avoids an unrelated exhausted balance affecting the race outcome.
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(begin,302,1,90,True),pool.submit(cancel,302)];race=[f.result() for f in futures]
    end=status(302)['state']
    expect(end in ('failed','pending') and (all(x['state']=='failed' for x in race) if end=='failed' else sorted(x['state'] for x in race)==['pending','started']),'begin versus cancellation has one serialized winner')
    expect(begin(302,premium=True)['state']==end,'race result remains stable on delayed begin')
    rejected(f"select cancel_unstarted_compatibility_operation('{uid(2)}','{uid(400)}');",'authenticated client cannot cancel another owner via RPC')
    rejected('select * from compatibility_cancellations;','tombstones are not directly readable by authenticated clients')
    sql(f"delete from partner_profiles where id='{uid(30)}';")
    expect(status(op=106)['state']=='failed' and balance()==3,'partner deletion reconciles pending reservation')
    rejected(f"select begin_compatibility_operation('{uid(1)}','{uid(200)}','{uid(90)}','{source_id}','{uid(30)}','{{}}','{{}}',true);",'client cannot declare premium or reserve as another owner')
    rejected(f"select read_compatibility_operation('{uid(1)}','{uid(100)}');",'client cannot call private reconciliation helper')
    rejected('select * from compatibility_operations;','private inputs cannot be read directly')
    profile={'display_name':'synthetic registration','birth_date':'2000-02-29','birth_time':None,'birthplace':'test','gender':'female','relationship_type':'family','relationship_label':'親'}
    def register(op=500, data=None): return service('register_partner_operation',[literal(uid(2)),literal(uid(op)),j(data or profile)])
    def registered(op=500,n=2):return service('get_partner_registration_operation',[literal(uid(n)),literal(uid(op))])
    def cancel_registration(op=600,n=2):return service('cancel_partner_registration_operation',[literal(uid(n)),literal(uid(op))])
    expect(cancel_registration()['state']=='cancelled' and registered(600)['state']=='cancelled','unregistered partner operation can be cancelled durably')
    expect(register(600)['state']=='cancelled' and sql(f"select count(*) from partner_profiles where user_id='{uid(2)}';")=='0','delayed registration cannot use a slot after cancellation')
    expect(registered(600,n=1)['state']=='not_found','registration cancellation is owner scoped')
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: cancellations=list(pool.map(lambda _:cancel_registration(),range(6)))
    expect(all(x['state']=='cancelled' for x in cancellations) and sql('select count(*) from partner_registration_cancellations;')=='1','parallel cancellation is idempotent')
    rejected(f"select cancel_partner_registration_operation('{uid(2)}','{uid(600)}');",'authenticated client cannot cancel registration via service RPC')
    rejected('select * from partner_registration_cancellations;','registration cancellations are private')
    expect(registered()['state']=='not_found','unregistered partner operation is distinguishable')
    sql("create function reject_registration() returns trigger language plpgsql as $$ begin raise exception 'injected_registration_failure'; end $$; create trigger reject_registration before insert on partner_registration_operations for each row execute function reject_registration();")
    try: register()
    except subprocess.CalledProcessError as error:
        if 'injected_registration_failure' not in error.stderr: raise
    else: raise AssertionError('registration transaction should fail')
    expect(sql(f"select count(*) from partner_profiles where user_id='{uid(2)}';")=='0','operation insert failure rolls back profile insert')
    sql('drop trigger reject_registration on partner_registration_operations;')
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: registered_results=list(pool.map(lambda _:register(),range(6)))
    first=registered_results[0]
    expect(all(x==first for x in registered_results) and first['state']=='completed' and first['remaining']==1,'six registration retries create one partner and return same acknowledgement')
    expect(cancel_registration(500)==first,'cancellation cannot delete a completed registration')
    expect(first['partner']['relationship_type']=='family','existing family API choice is supported by schema')
    expect(registered()==first and registered(n=1)['state']=='not_found','lost registration reply is owner-scoped recoverable')
    expect(register(data=dict(profile,display_name='different'))['state']=='conflict','changed profile cannot reuse registration ID')
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: distinct=list(pool.map(register,range(501,507)))
    expect(sum(x['state']=='completed' for x in distinct)==1 and sum(x['state']=='limit' for x in distinct)==5,'concurrent distinct registrations respect two-partner capacity')
    expect(register()['partner']['id']==first['partner']['id'],'replay works even at full capacity')
    sql(f"delete from partner_profiles where id='{first['partner']['id']}';")
    expect(register()['state']=='deleted' and registered()['state']=='deleted','deleted registration cannot recreate partner on replay')
    expect(cancel_registration(500)['state']=='deleted','cancellation preserves deleted registration status')
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures=[pool.submit(register,601),pool.submit(cancel_registration,601)];race=[f.result() for f in futures]
    winner=registered(601)['state']
    expect(winner in ('cancelled','completed') and all(item['state']==winner for item in race),'registration versus cancel race has one durable winner')
    if winner=='completed': sql(f"delete from partner_profiles where id='{registered(601)['partner']['id']}';")
    def direct_insert(index):
        try:
            sql(f"insert into partner_profiles(user_id,display_name,birth_date,birthplace,gender,relationship_type) values('{uid(2)}','direct-{index}','2000-01-01','test','female','friend');")
            return True
        except subprocess.CalledProcessError as error:
            if 'partner_profile_limit' not in error.stderr: raise
            return False
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: inserted=list(pool.map(direct_insert,range(6)))
    expect(sum(inserted)==1 and sql(f"select count(*) from partner_profiles where user_id='{uid(2)}';")=='2','trigger also serializes concurrent inserts outside registration RPC')
    rejected(f"select register_partner_operation('{uid(2)}','{uid(599)}',{j(profile)});",'authenticated client cannot register as another owner via RPC')
    rejected('select * from partner_registration_operations;','registration journal is private')
    # Check service-only legacy points independently from the operation journals.
    rejected(f"select deduct_points('{uid(1)}',-3);",'authenticated role cannot exploit negative debit')
    rejected(f"select add_points('{uid(1)}',100);",'authenticated role cannot grant points to self or another owner')
    rejected('truncate user_points;','authenticated role cannot bypass RLS through truncate')
    rejected(f"update user_points set balance=100 where user_id='{uid(1)}';",'authenticated role cannot directly change balance')
    expect(owner('select count(*) from user_points;')=='1','authenticated owner can read only their own point row')
    for name,arg in [('deduct_points','-1'),('deduct_points','0'),('deduct_points','null'),('add_points','-1'),('add_points','0'),('add_points','null')]:
        before=balance()
        try: service(name,[literal(uid(1)),arg])
        except subprocess.CalledProcessError as error:
            if 'invalid_point_' not in error.stderr: raise
        else: raise AssertionError('invalid points accepted')
        expect(balance()==before,name+' rejects '+arg+' without mutation')
    sql(f"update user_points set balance=3 where user_id='{uid(1)}';")
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: debits=list(pool.map(lambda _:service('deduct_points',[literal(uid(1)),'3']),range(6)))
    expect(debits.count(0)==1 and debits.count(-1)==5 and balance()==0,'service legacy debit is atomic under concurrency')
    expect(service('add_points',[literal(uid(1)),'3'])==3,'service credit still works with restricted EXECUTE')
    try: service('deduct_points',[literal(uid(9999)),'3'])
    except subprocess.CalledProcessError as error:
        if 'points_dependency_missing' not in error.stderr: raise
    else: raise AssertionError('missing points dependency accepted')
    expect(True,'missing point row is distinct from insufficient funds')
    expect(sql("select has_function_privilege('anon','public.add_points(uuid,integer)','EXECUTE') or has_function_privilege('anon','public.deduct_points(uuid,integer)','EXECUTE');")=='f','anonymous role cannot mutate points through legacy RPCs')
    sql(f"delete from auth.users where id='{uid(2)}';")
    expect(sql('select count(*) from partner_registration_operations;')=='0','account deletion removes registration journal')
    expect(sql('select count(*) from partner_registration_cancellations;')=='0','account deletion removes registration cancellation records')
    sql(f"delete from auth.users where id='{uid(1)}';")
    expect(sql('select count(*) from compatibility_operations;')=='0','account deletion removes operation inputs')
    expect(sql(f"select count(*) from compatibility_cancellations where user_id='{uid(1)}';")=='0','account deletion removes cancellation tombstones')
    # Real HTTP/JWT/router with a local SQL transport bridge; not PostgREST acceptance.
    env['D02_TEST_SOCKET'] = str(socket)
    env['D02_TEST_PSQL'] = psql
    print(command(['node', '--import', 'tsx', 'src/scripts/testPartnerRegistrationLocal.ts'], cwd=str(base.parent)), flush=True)
finally:
    if started: command([str(binpath/'pg_ctl'),'-D',str(cluster),'-m','fast','-w','stop'])
    print('Local cluster stopped:',root,flush=True)
