"""Disposable local Postgres only. Requires D02_GEN_PG_BIN; never reads DB URLs."""
import concurrent.futures, json, os, pathlib, subprocess, tempfile

base = pathlib.Path(__file__).resolve().parents[1]
binpath = pathlib.Path(os.environ['D02_GEN_PG_BIN']).resolve()
psql = os.environ.get('D02_PSQL', '/opt/homebrew/opt/libpq/bin/psql')
root = pathlib.Path(tempfile.mkdtemp(prefix='fatelab-d02-gen-', dir='/private/tmp'))
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
def expect(value,message):
    if not value: raise AssertionError(message)
    print('PASS',message,flush=True)
def rpc(name,args): return json.loads(sql(f"set role service_role; select {name}({','.join(args)});"))
def begin(op=10,owner=1,worker=90,payload=None,context=None):
    return rpc('begin_self_generation',[literal(uid(owner)),literal(uid(op)),literal(uid(worker)),literal(json.dumps(payload or {'date':'2000-01-01'}))+'::jsonb',literal(json.dumps(context or {'version':'synthetic-v1'}))+'::jsonb'])
def status(op=10,owner=1):return rpc('get_self_generation',[literal(uid(owner)),literal(uid(op))])
def settle(op=10,owner=1,worker=90,result=None):
    return rpc('settle_self_generation',[literal(uid(owner)),literal(uid(op)),literal(uid(worker)),'null' if result is None else literal(json.dumps(result))+'::jsonb'])
report={'version':3,'reportText':'synthetic body','cards':[{'id':'synthetic'}],'generatorVersion':'synthetic-v1','unknownMetadata':{'keep':True}}
try:
    command([str(binpath/'initdb'),'-D',str(cluster),'--no-locale','-A','trust','-U','postgres'])
    command([str(binpath/'pg_ctl'),'-D',str(cluster),'-l',str(root/'postgres.log'),'-o',f"-F -k {socket} -p 55472 -c listen_addresses=''",'-w','start']);started=True
    sql("create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);")
    sql(f"insert into auth.users values('{uid(1)}'),('{uid(2)}');")
    sql((base/'self_generation_d02.sql').read_text())
    expect(status()['state']=='not_found','never-started operation is distinguishable')
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool: results=list(pool.map(lambda _:begin(),range(6)))
    expect(sum(x['state']=='started' for x in results)==1,'six concurrent requests start one worker')
    expect(begin(payload={'date':'2001-01-01'})['state']=='conflict','changed input with same operation conflicts')
    expect(status(owner=2)['state']=='not_found','other owner cannot observe operation')
    expect(settle(worker=91,result=report)['state']=='pending','different worker cannot commit')
    expect(settle(result=report)['state']=='completed','complete report is durable')
    expect(status()['result']==report,'status recovers full report and unknown metadata')
    expect(begin(context={'version':'synthetic-v2'})['result']==report,'retry on newer runtime returns original result')
    expect(sql(f"select runtime_context->>'version' from self_generation_operations where op_id='{uid(10)}';")=='synthetic-v1','runtime context is not overwritten')
    expect(settle(result={'version':3,'reportText':'changed','cards':[]})['result']==report,'completed report cannot be overwritten')
    expect(settle()['state']=='completed','late failure cannot erase completed report')
    expect(begin(owner=2)['state']=='started','operation ID may be reused by another owner')
    expect(settle(owner=2)['state']=='failed','explicit worker failure is terminal')
    expect(begin(owner=2)['state']=='failed','same failed operation does not regenerate')
    begin(op=11)
    sql(f"update self_generation_operations set lease_until=now()-interval '1 second' where op_id='{uid(11)}';")
    expect(status(11)['state']=='failed','expired operation becomes failed through status')
    expect(settle(op=11,result=report)['state']=='failed','expired worker cannot publish late result')
    begin(op=12)
    try: settle(op=12,result={'version':3,'reportText':'bad','cards':'invalid'})
    except subprocess.CalledProcessError: pass
    else: raise AssertionError('invalid report accepted')
    expect(status(12)['state']=='pending','invalid completion rolls back and stays reconcilable')
    expect(settle(op=12,result=report)['state']=='completed','same worker can retry a rolled-back completion')
    expect(sql("select has_function_privilege('authenticated','begin_self_generation(uuid,uuid,uuid,jsonb,jsonb)','execute');")=='f','client cannot impersonate owner via RPC')
    expect(sql("select has_table_privilege('authenticated','self_generation_operations','select');")=='f','private requests cannot be read directly')
    sql(f"delete from auth.users where id='{uid(1)}';")
    expect(status()['state']=='not_found','account deletion removes request and result')
finally:
    if started: command([str(binpath/'pg_ctl'),'-D',str(cluster),'-m','fast','-w','stop'])
    print('Local cluster stopped:',root,flush=True)
