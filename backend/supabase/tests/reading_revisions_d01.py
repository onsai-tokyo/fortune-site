"""Disposable local Postgres only. Requires D01_PG_BIN; never reads DB URLs."""
import concurrent.futures, json, os, pathlib, subprocess, tempfile

base = pathlib.Path(__file__).resolve().parents[1]
binpath = pathlib.Path(os.environ['D01_PG_BIN']).resolve()
psql = os.environ.get('D01_PSQL', '/opt/homebrew/opt/libpq/bin/psql')
root = pathlib.Path(tempfile.mkdtemp(prefix='fatelab-d01-', dir='/private/tmp'))
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
try:
    command([str(binpath/'initdb'), '-D', str(cluster), '--no-locale', '-A', 'trust', '-U', 'postgres'])
    command([str(binpath/'pg_ctl'), '-D', str(cluster), '-l', str(root/'postgres.log'), '-o', f"-F -k {socket} -p 55472 -c listen_addresses=''", '-w', 'start'])
    started=True
    sql("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key); create table subscriptions(id uuid); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to authenticated;")
    sql((base.parents[1]/'supabase-reading-stripe.sql').read_text())
    sql((base/'partner_profiles.sql').read_text())
    sql((base/'reading_conversation_bookmarks_build44.sql').read_text())
    sql((base/'reading_conversation_kind_chat_build55.sql').read_text())
    sql(f"insert into auth.users values ('{uid(1)}'),('{uid(2)}'); grant select,insert,update,delete on reading_conversations to authenticated; insert into reading_conversations(id,user_id,report_text) values('{uid(10)}','{uid(1)}','legacy');")
    sql(f"insert into partner_profiles(id,user_id,display_name,birth_date,birthplace,gender,relationship_type) values('{uid(30)}','{uid(1)}','synthetic','2000-01-01','test','female','friend'); alter table reading_conversations add constraint test_partner_fk foreign key(partner_profile_id) references partner_profiles(id) on delete set null;")
    before=sql("select to_jsonb(c)::text from reading_conversations c;")
    sql((base/'reading_revisions_d01.sql').read_text())
    expect(sql("select (to_jsonb(c)-'reading_revision_id')::text from reading_conversations c;")==before,'migration preserves every legacy field')
    expect(sql("select declared_versions is null and origin='legacy_snapshot' from reading_revisions;")=='t','legacy versions remain unknown')
    p=dict(birthData=dict(date='2000-01-01'),calculatedData=dict(score=20),reportText='v1 body',kind='self',partnerProfileId=None,sourceSection=None,sourceYear=None,declaredVersions=dict(generatorVersion='synthetic-v1'))
    first=save('op1',p)
    expect(save('op1',p)['id']==first['id'],'same operation retries return original ID')
    expect(save('op2',p)['id']==first['id'],'different operations same payload deduplicate')
    p2=dict(p,reportText='v2 body',declaredVersions=dict(generatorVersion='synthetic-v2'))
    expect(save('op1',p2).get('conflict') is True,'same operation different payload conflicts')
    second=save('op3',p2)
    expect(first['readingId']==second['readingId'] and first['revisionId']!=second['revisionId'],'new payload creates revision within logical reading')
    expect(owner(f"select report_text from reading_conversations where id='{first['id']}';")=='v1 body','old body is unchanged')
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results=list(pool.map(lambda i:save('parallel'+str(i),dict(p,reportText='parallel')),range(6)))
    expect(len(set(x['id'] for x in results))==1,'concurrent distinct operations create one snapshot')
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        results=list(pool.map(lambda i:save('same-parallel',dict(p,reportText='same-parallel')),range(6)))
    expect(len(set(x['id'] for x in results))==1,'concurrent same operation creates one snapshot')
    rejected(f"update reading_conversations set report_text='corrupt' where id='{first['id']}';",'conversation body is immutable')
    rejected(f"update reading_revisions set payload='{{}}' where id='{first['revisionId']}';",'users cannot mutate revisions')
    owner(f"update reading_conversations set title='new title',is_saved=true where id='{first['id']}';")
    expect(owner(f"select is_saved from reading_conversations where id='{first['id']}';")=='t','title and bookmark remain editable')
    expect(owner('select count(*) from reading_revisions;',2)=='0','other owner cannot read revisions')
    rejected(f"insert into reading_conversations(user_id,reading_revision_id,report_text,calculated_data) values('{uid(2)}','{first['revisionId']}','v1 body',jsonb_build_object('score',20));",'foreign revision cannot be attached',2)
    chat=owner(f"insert into reading_conversations(user_id,reading_revision_id,kind,birth_data,calculated_data,report_text) select user_id,reading_revision_id,'chat',birth_data,calculated_data,report_text from reading_conversations where id='{first['id']}' returning id;")
    expect(owner(f"select report_text from reading_conversations where id='{chat}';")=='v1 body','chat pins source revision body')
    rejected(f"update reading_conversations set reading_revision_id='{second['revisionId']}' where id='{chat}';",'chat cannot move to a newer revision')
    expect(save('op1',p,2)['id']!=first['id'],'operation IDs are scoped to owner')
    sql("create function fail_d01() returns trigger language plpgsql as $$ begin if new.report_text='fail' then raise exception 'injected'; end if; return new; end $$; create trigger fail_d01 before insert on reading_conversations for each row execute function fail_d01();")
    counts=sql('select count(*) from reading_revisions;')
    try: save('failure',dict(p,reportText='fail'))
    except subprocess.CalledProcessError: pass
    else: raise AssertionError('injected failure did not occur')
    expect(sql('select count(*) from reading_revisions;')==counts and sql("select count(*) from reading_save_operations where op_id='failure';")=='0','failed save rolls back revision and operation together')
    owner(f"delete from reading_conversations where id='{second['id']}';")
    expect(save('op3',p2).get('deleted') is True,'retry cannot resurrect an explicitly deleted conversation')
    partner=save('partner',dict(p,kind='compatibility',partnerProfileId=uid(30)))
    try: save('foreign-partner',dict(p,kind='compatibility',partnerProfileId=uid(30)),2)
    except subprocess.CalledProcessError: print('PASS RPC rejects foreign partner',flush=True)
    else: raise AssertionError('foreign partner accepted')
    sql(f"delete from partner_profiles where id='{uid(30)}';")
    expect(sql(f"select partner_profile_id is null from reading_conversations where id='{partner['id']}';")=='t','partner deletion keeps existing FK behavior')
    expect(save('partner',dict(p,kind='compatibility',partnerProfileId=uid(30)))['id']==partner['id'],'retry after partner deletion returns saved revision')
    expect(sql(f"select payload->>'partnerProfileId' from reading_revisions where id='{partner['revisionId']}';")==uid(30),'partner deletion preserves historical snapshot')
finally:
    if started: command([str(binpath/'pg_ctl'), '-D', str(cluster), '-m', 'fast', '-w', 'stop'])
    print('Local cluster stopped:',root,flush=True)
