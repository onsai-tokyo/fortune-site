"""Disposable local Postgres only. Requires D02_PG_BIN; never reads DB URLs."""
import concurrent.futures, json, os, pathlib, subprocess, tempfile

base = pathlib.Path(__file__).resolve().parents[1]
binpath = pathlib.Path(os.environ['D02_PG_BIN']).resolve()
psql = os.environ.get('D02_PSQL', '/opt/homebrew/opt/libpq/bin/psql')
root = pathlib.Path(tempfile.mkdtemp(prefix='fatelab-d02-question-reconcile-', dir='/private/tmp'))
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
def expect(condition,message):
    if not condition: raise AssertionError(message)
    print('PASS',message,flush=True)
def rpc(name,args):
    return json.loads(sql(f"set role service_role; select {name}({','.join(args)});"))
def begin(op=1,owner=1,question='question',worker=90,conversation=10,free='100',user=100,glob=100):
    return rpc('begin_reading_question',[literal(uid(owner)),literal(uid(op)),literal(uid(conversation)),literal(question),literal(uid(worker)),free,str(user),str(glob)])
def finish(op=1,owner=1,worker=90,answer='answer'):
    return rpc('complete_reading_question',[literal(uid(owner)),literal(uid(op)),literal(uid(worker)),literal(answer),"ARRAY['test']","'[]'::jsonb"])
def fail(op=1,owner=1,worker=90,expired=False):
    return rpc('fail_reading_question',[literal(uid(owner)),literal(uid(op)),literal(uid(worker)),'true' if expired else 'false'])
try:
    command([str(binpath/'initdb'),'-D',str(cluster),'--no-locale','-A','trust','-U','postgres'])
    command([str(binpath/'pg_ctl'),'-D',str(cluster),'-l',str(root/'postgres.log'),'-o',f"-F -k {socket} -p 55472 -c listen_addresses=''",'-w','start']);started=True
    sql("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create table subscriptions(id uuid); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;")
    sql((base.parents[1]/'supabase-reading-stripe.sql').read_text())
    sql((base/'ai_chat_monthly_budget.sql').read_text())
    sql(f"insert into auth.users values('{uid(1)}'),('{uid(2)}'); insert into reading_conversations(id,user_id) values('{uid(10)}','{uid(1)}'),('{uid(11)}','{uid(2)}');")
    sql((base/'question_operations_d02.sql').read_text())
    sql((base/'question_reconciliation_d02.sql').read_text())
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: outcomes=list(pool.map(lambda _:begin(),range(6)))
    expect(sum(x['state']=='started' for x in outcomes)==1,'six concurrent retries start one worker')
    expect(sql(f"select free_questions_used from reading_usage where user_id='{uid(1)}';")=='1','one free reservation')
    expect(sql('select question_count from ai_chat_monthly_global_usage;')=='1','one global reservation')
    expect(begin(question='changed')['state']=='conflict','same operation different payload conflicts')
    expect(begin(op=2)['state']=='busy','different operation cannot race conversation history')
    expect(finish(worker=91)['state']=='pending','other worker cannot commit')
    result=finish()
    expect(result['state']=='completed','question and answer commit together')
    expect(finish()==result and begin()['result']==result['result'],'lost completion acknowledgement replays same saved answer')
    expect(sql('select count(*) from reading_messages;')=='2','retries never duplicate either message')
    expect(fail()['state']=='completed','late failure cannot refund completed answer')
    expect(sql('select question_count from ai_chat_monthly_global_usage;')=='1','completed reservation retained')
    expect(begin(op=3)['state']=='started','new operation after completion allowed')
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: list(pool.map(lambda _:fail(op=3),range(6)))
    expect(sql('select question_count from ai_chat_monthly_global_usage;')=='1','concurrent failure refunds once')
    expect(sql('select count(*) from reading_messages;')=='2','failure leaves no partial question')
    expect(begin(op=3)['state']=='failed','failed operation is terminal rather than implicit regeneration')
    expect(begin(op=4,owner=2)['state']=='not_found','foreign conversation cannot be reserved')
    expect(begin(op=1,owner=2,conversation=11)['state']=='started','operation IDs scoped to owner')
    fail(op=1,owner=2)
    # Inject a failure after question insert: completion must roll back both messages.
    begin(op=5)
    sql("create function fail_d02() returns trigger language plpgsql as $$ begin if new.content='injected' then raise exception 'synthetic_failure'; end if; return new; end $$; create trigger fail_d02 before insert on reading_messages for each row execute function fail_d02();")
    try: finish(op=5,answer='injected')
    except subprocess.CalledProcessError: pass
    else: raise AssertionError('failure injection ignored')
    expect(sql('select count(*) from reading_messages;')=='2','failed commit rolls back both message writes')
    expect(sql(f"select state from reading_question_operations where user_id='{uid(1)}' and op_id='{uid(5)}';")=='pending','uncertain completion remains reconcilable')
    expect(fail(op=5,expired=True)['state']=='pending','status does not release live worker')
    sql(f"update reading_question_operations set lease_until=now()-interval '1 second' where op_id='{uid(5)}';")
    expect(fail(op=5,expired=True)['state']=='failed','expired worker reclaimed exactly once')
    expect(finish(op=5)['state']!='completed','expired worker cannot commit late result')
    # Reservation month is historical, not the month of reconciliation.
    begin(op=6)
    sql(f"insert into ai_chat_monthly_global_usage values('2000-01-01',1,now()); insert into ai_chat_monthly_user_usage values('2000-01-01','{uid(1)}',1,now()); update reading_question_operations set usage_month='2000-01-01' where op_id='{uid(6)}';")
    current=sql("select sum(question_count) from ai_chat_monthly_global_usage where usage_month<>'2000-01-01';")
    fail(op=6)
    expect(sql("select question_count from ai_chat_monthly_global_usage where usage_month='2000-01-01';")=='0','refund uses original reservation month')
    expect(sql("select sum(question_count) from ai_chat_monthly_global_usage where usage_month<>'2000-01-01';")==current,'refund does not touch a different month')
    expect(begin(op=7,free='0')['code']=='FREE_LIMIT_REACHED','free limit does not reserve monthly budget')
    used=sql(f"select free_questions_used from reading_usage where user_id='{uid(1)}';")
    expect(begin(op=8,glob=0)['code']=='AI_MONTHLY_BUDGET_REACHED','global limit reports rejection')
    expect(sql(f"select free_questions_used from reading_usage where user_id='{uid(1)}';")==used,'global rejection compensates free reservation atomically')
    expect(sql("select has_function_privilege('authenticated','begin_reading_question(uuid,uuid,uuid,text,uuid,integer,integer,integer)','execute');")=='f','client cannot choose quota or premium limits')
    expect(sql("select has_table_privilege('authenticated','reading_question_operations','select');")=='f','operation results are not public')
    def sweep(apply=False,limit=100):return rpc('reconcile_reading_questions',[str(apply).lower(),str(limit)])
    def expire(*ops):sql("update reading_question_operations set lease_until=statement_timestamp()-interval '1 second' where op_id in ("+','.join(literal(uid(n)) for n in ops)+");")
    def lock_session(query):
        args=[psql,'-X','-qAt','-v','ON_ERROR_STOP=1','-h',str(socket),'-p','55472','-U','postgres','-d','postgres']
        process=subprocess.Popen(args,env=env,text=True,stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
        process.stdin.write("begin; "+query+"; select 'ready';\n");process.stdin.flush()
        while True:
            line=process.stdout.readline()
            if not line:raise AssertionError('lock session stopped')
            if line.strip()=='ready':return process
    def unlock(process):
        process.stdin.write('rollback;\n');process.stdin.flush();process.communicate(timeout=5)
        expect(process.returncode==0,'lock session closes cleanly')
    month=sql("select date_trunc('month',timezone('Asia/Tokyo',now()))::date;")
    def global_count():return int(sql(f"select question_count from ai_chat_monthly_global_usage where usage_month='{month}';"))
    def free_count():return int(sql(f"select free_questions_used from reading_usage where user_id='{uid(1)}';"))
    def counters():return sql("select jsonb_build_object('global',(select jsonb_agg(to_jsonb(g) order by usage_month) from ai_chat_monthly_global_usage g),'user',(select jsonb_agg(to_jsonb(u) order by usage_month,user_id) from ai_chat_monthly_user_usage u),'free',(select jsonb_agg(to_jsonb(f) order by user_id) from reading_usage f));")
    g0,f0=global_count(),free_count()
    for conv in range(20,31):sql(f"insert into reading_conversations(id,user_id) values('{uid(conv)}','{uid(2 if conv in [24,26] else 1)}');")
    for op,conv in [(100,20),(101,21),(103,23)]:expect(begin(op=op,conversation=conv)['state']=='started','fixture reserves free question '+str(op))
    begin(op=102,conversation=22,free='null');begin(op=104,owner=2,conversation=24);finish(op=104,owner=2)
    # Move one reservation to the prior month together with its actual counters.
    sql(f"insert into ai_chat_monthly_global_usage values('2000-02-01',1,now()); insert into ai_chat_monthly_user_usage values('2000-02-01','{uid(1)}',1,now()); update ai_chat_monthly_global_usage set question_count=question_count-1 where usage_month='{month}'; update ai_chat_monthly_user_usage set question_count=question_count-1 where usage_month='{month}' and user_id='{uid(1)}'; update reading_question_operations set usage_month='2000-02-01' where op_id='{uid(100)}';")
    expire(100,101,102)
    before=counters();operations=sql('select jsonb_agg(to_jsonb(o) order by user_id,op_id) from reading_question_operations o;')
    plan=sweep(limit=2)
    expect(plan=={'mode':'dry_run','examined':2,'wouldReleaseFree':2,'wouldReleaseMonthly':2,'reconciled':0,'releasedFree':0,'releasedMonthly':0,'hasMore':True,'busy':False},'preview reports bounded quota counts')
    readonly=json.loads(sql('begin read only; set role service_role; select reconcile_reading_questions(false,2); commit;'))
    expect(readonly==plan and counters()==before and sql('select jsonb_agg(to_jsonb(o) order by user_id,op_id) from reading_question_operations o;')==operations,'read-only preview leaves every counter and operation unchanged')
    begin(op=105,owner=2,conversation=26);expire(105)
    locked=lock_session(f"select pg_advisory_xact_lock(hashtextextended('question-owner:'||'{uid(1)}',0))")
    try:
        result=sweep(True)
        expect(result['reconciled']==1 and result['hasMore'] and global_count()==g0+4,'busy owner is skipped while other owner is recovered')
    finally:unlock(locked)
    locked=lock_session(f"select op_id from reading_question_operations where op_id='{uid(100)}' for update")
    try:
        result=sweep(True)
        expect(result['reconciled']==2 and result['releasedFree']==1 and result['releasedMonthly']==2 and result['hasMore'],'locked operation skipped; premium releases monthly only')
    finally:unlock(locked)
    expect(sweep(True)['releasedMonthly']==1,'later batch recovers previously locked reservation')
    expect(sql("select question_count from ai_chat_monthly_global_usage where usage_month='2000-02-01';")=='0','sweep releases original reservation month')
    expect(global_count()==g0+2 and free_count()==f0+1,'active and completed questions keep their counters')
    expect(finish(op=104,owner=2)['state']=='completed' and fail(op=103,expired=True)['state']=='pending','completed answer and live worker are unchanged')
    before=counters();expect(sweep(True)['reconciled']==0 and counters()==before,'repeat sweep cannot release twice')
    begin(op=106,conversation=27);expire(106)
    locked=lock_session("select pg_advisory_xact_lock(hashtextextended('question-reconciliation',0))")
    try:expect(sweep(True)['busy'],'second operator receives busy')
    finally:unlock(locked)
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:batches=list(pool.map(lambda _:sweep(True),range(6)))
    expect(sum(x['reconciled'] for x in batches)==1 and global_count()==g0+2,'six simultaneous sweepers release one reservation')
    begin(op=107,conversation=28);begin(op=108,conversation=29);expire(107,108);before=counters()
    sql(f"create function reject_question_sweep() returns trigger language plpgsql as $$ begin if new.op_id='{uid(108)}' and new.state='failed' then raise exception 'injected_batch_failure'; end if; return new; end $$; create trigger reject_question_sweep before update on reading_question_operations for each row execute function reject_question_sweep();")
    try:sweep(True)
    except subprocess.CalledProcessError:pass
    else:raise AssertionError('batch failure not injected')
    expect(counters()==before and sql(f"select count(*) from reading_question_operations where op_id in ('{uid(107)}','{uid(108)}') and state='pending';")=='2','later failure rolls back all free and monthly releases')
    sql('drop trigger reject_question_sweep on reading_question_operations;')
    result=sweep(True,1);expect(result['reconciled']==1 and result['hasMore'],'apply honors one-operation limit')
    expect(sweep(True)['reconciled']==1 and global_count()==g0+2,'rolled-back remainder safely retries')
    begin(op=109,conversation=30);expire(109)
    sql(f"update reading_question_operations set usage_month='2001-01-01' where op_id='{uid(109)}';");before=counters()
    try:sweep(True)
    except subprocess.CalledProcessError:pass
    else:raise AssertionError('missing monthly rows accepted')
    expect(counters()==before and sql(f"select state from reading_question_operations where op_id='{uid(109)}';")=='pending','missing counters fail closed without claiming a refund')
    sql(f"update reading_question_operations set usage_month='{month}' where op_id='{uid(109)}';")
    expect(sweep(True)['reconciled']==1,'corrected fixture reconciles normally')
    for args in [['true','0'],['true','101'],['null','1']]:
        try:rpc('reconcile_reading_questions',args)
        except subprocess.CalledProcessError:pass
        else:raise AssertionError('invalid options accepted')
    print('PASS invalid batch options rejected',flush=True)
    expect(sql("select has_function_privilege('authenticated','reconcile_reading_questions(boolean,integer)','execute');")=='f','ordinary user cannot invoke operator sweep')
    begin(op=9)
    count=sql("select sum(question_count) from ai_chat_monthly_global_usage where usage_month<>'2000-01-01';")
    sql(f"delete from reading_conversations where id='{uid(10)}';")
    expect(int(sql("select sum(question_count) from ai_chat_monthly_global_usage where usage_month<>'2000-01-01';"))==int(count)-1,'conversation deletion releases pending reservation')
    expect(fail(op=9,expired=True)['state']=='deleted','deleted operation remains a tombstone')
finally:
    if started: command([str(binpath/'pg_ctl'),'-D',str(cluster),'-m','fast','-w','stop'])
    print('Local cluster stopped:',root,flush=True)
