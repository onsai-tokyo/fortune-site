"""Disposable PostgreSQL test; never connects to a live database."""
import concurrent.futures,json,os,pathlib,subprocess,tempfile
base=pathlib.Path(__file__).resolve().parents[1];bin=pathlib.Path(os.environ['BOOKS_PG_BIN'])
root=pathlib.Path(tempfile.mkdtemp(prefix='fatelab-partner-limits-',dir='/private/tmp'));socket=root/'socket';socket.mkdir()
def run(args,**kw):return subprocess.run(args,text=True,capture_output=True,check=True,**kw).stdout.strip()
def sql(q):return run(['/opt/homebrew/opt/libpq/bin/psql','-XqAt','-v','ON_ERROR_STOP=1','-h',str(socket),'-p','55479','-U','postgres'],input=q)
def uid(i):return f'{i:08d}-1111-4111-8111-111111111111'
def register(i,user=1):
 p=json.dumps(dict(display_name='synthetic',birth_date='2000-01-01',birthplace='test',gender='female',relationship_type='friend',relationship_label='友人'))
 return json.loads(sql(f"set role service_role;select register_partner_operation('{uid(user)}','{uid(i)}','{p}'::jsonb);"))
try:
 run([str(bin/'initdb'),'-D',str(root/'data'),'--no-locale','--encoding=UTF8','-A','trust','-U','postgres'])
 run([str(bin/'pg_ctl'),'-D',str(root/'data'),'-l',str(root/'postgres.log'),'-o',f"-F -k {socket} -p 55479 -c listen_addresses=''",'-w','start'])
 sql("create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create table stripe_subscriptions(user_id uuid,subscription_status text,current_period_end timestamptz);create table app_store_subscriptions(user_id uuid,subscription_status text,expires_at timestamptz,revoked_at timestamptz);")
 for file in ['partner_profiles.sql','partner_relationship_build45.sql','partner_registration_d02.sql','partner_registration_cancellation_d02.sql']:sql((base/file).read_text())
 sql(f"insert into auth.users values('{uid(1)}'),('{uid(2)}');")
 assert register(100)['state']=='completed';assert register(101)['state']=='completed'
 sql((base/'partner_plan_limits_20260927.sql').read_text())
 assert register(102)['state']=='limit';assert register(100)['remaining']==0
 assert sql(f"select count(*) from partner_profiles where user_id='{uid(1)}';")=='2'
 print('PASS existing free profiles retained and replay remains idempotent')
 assert register(200,2)['state']=='completed';assert register(201,2)['state']=='limit'
 print('PASS free cap is one')
 sql(f"insert into app_store_subscriptions values('{uid(1)}','active',now()+interval '1 month',null);")
 with concurrent.futures.ThreadPoolExecutor(max_workers=12) as pool:results=list(pool.map(register,range(300,312)))
 assert sum(r['state']=='completed' for r in results)==8
 assert sql(f"select count(*) from partner_profiles where user_id='{uid(1)}';")=='10'
 print('PASS concurrent member registration stops at ten')
 sql("update app_store_subscriptions set expires_at=now()-interval '1 second';")
 assert register(500)['state']=='limit';assert register(100)['remaining']==0
 sql("update app_store_subscriptions set expires_at=now()+interval '1 month',revoked_at=now();")
 assert sql(f"set role service_role;select partner_profile_capacity('{uid(1)}');")=='1'
 print('PASS expiry and refund reduce capacity without deleting profiles')
 sql(f"insert into stripe_subscriptions values('{uid(1)}','trialing',now()+interval '1 month');")
 assert sql(f"set role service_role;select partner_profile_capacity('{uid(1)}');")=='10'
 for role in ['anon','authenticated']:assert sql(f"select has_function_privilege('{role}','public.partner_profile_capacity(uuid)','execute');")=='f'
 print('PASS Stripe access parity and RPC permissions')
finally:
 subprocess.run([str(bin/'pg_ctl'),'-D',str(root/'data'),'-m','immediate','stop'],capture_output=True)
