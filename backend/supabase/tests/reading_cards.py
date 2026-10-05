"""Local disposable PostgreSQL only. Never reads dotenv or remote database URLs."""
import concurrent.futures,os,pathlib,subprocess,tempfile
base=pathlib.Path(__file__).resolve().parents[1]
binpath=pathlib.Path(os.environ['READING_CARDS_PG_BIN'])
root=pathlib.Path(tempfile.mkdtemp(prefix='fatelab-card-db-',dir='/private/tmp'))
cluster=root/'data';sock=root/'socket';sock.mkdir()
env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
def run(args,**kwargs):
 p=subprocess.run(args,env=env,text=True,capture_output=True,**kwargs)
 if p.returncode:raise RuntimeError(p.stderr)
 return p.stdout.strip()
def sql(q):return run(['/opt/homebrew/opt/libpq/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',str(sock),'-p','55483','-U','postgres','-d','postgres'],input=q)
def user(n):return f'{n:08d}-1111-4111-8111-111111111111'
def ok(value,label):
 assert value,label
 print('PASS',label,flush=True)
def fails(q,expected):
 try:sql(q)
 except RuntimeError as e:ok(expected in str(e),expected);return
 raise AssertionError('SQL unexpectedly succeeded: '+q)
def grant(tx,owner=1,revoked=False,signed=100,environment='Sandbox'):
 return sql(f"select public.reading_card_grant('{user(owner)}','{environment}','{tx}',now(),{signed},{str(revoked).lower()});")
def unlock(offer='self:year:2027',target='a'*64,owner=1,environment='Sandbox'):
 return sql(f"select public.reading_card_unlock('{user(owner)}','{environment}','{target}','{offer}');")
started=False
try:
 run([str(binpath/'initdb'),'-D',str(cluster),'--no-locale','--encoding=UTF8','-A','trust','-U','postgres'])
 run([str(binpath/'pg_ctl'),'-D',str(cluster),'-l',str(root/'pg.log'),'-o',f"-F -k {sock} -p 55483 -c listen_addresses=''",'-w','start']);started=True
 sql('create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);')
 sql('create table public.self_generation_operations(user_id uuid,op_id uuid,request_payload jsonb);')
 sql('create table public.partner_profiles(id uuid primary key);')
 sql((base/'couple_timeline_settings_v4.sql').read_text())
 sql((base/'reading_card_meeting_retention_20261005.sql').read_text())
 sql((base/'reading_card_purchases_20261005.sql').read_text())
 sql(f"insert into auth.users values ('{user(1)}'),('{user(2)}');")
 sql(f"insert into partner_profiles values ('{user(3)}'); insert into couple_timeline_settings(user_id,relationship_key,partner_profile_id,meeting_year) values ('{user(1)}','{'c'*64}','{user(3)}',2020); delete from partner_profiles where id='{user(3)}';")
 ok(sql("select meeting_year=2020 and partner_profile_id is null from couple_timeline_settings;")=='t','deleting a partner preserves the purchased timeline meeting year')
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(lambda _:grant('100'),range(4)))
 ok(sql('select count(*) from public.reading_card_purchases;')=='1','duplicate delivery grants exactly once')
 def race(offer):
  try:unlock(offer);return 'ok'
  except RuntimeError as e:return 'no_credit' if 'READING_CARD_NO_CREDIT' in str(e) else str(e)
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:results=list(pool.map(race,['self:year:2027','self:year:2028']))
 ok(sorted(results)==['no_credit','ok'],'one credit cannot unlock two different years concurrently')
 selected=sql('select offer_key from public.reading_card_purchases;')
 with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:list(pool.map(lambda _:unlock(selected),range(3)))
 ok(sql('select count(*) from public.reading_card_purchases where target_key is not null;')=='1','same target retries are idempotent')
 fails(f"select public.reading_card_grant('{user(2)}','Sandbox','100',now(),200,false);",'READING_CARD_OWNER_MISMATCH')
 grant('100',revoked=True,signed=50);grant('100',signed=300)
 ok(sql("select revoked from public.reading_card_purchases where transaction_id='100';")=='t','older refund cannot be undone by newer non-revoked delivery')
 fails(f"select public.reading_card_unlock('{user(1)}','Sandbox','{'a'*64}','{selected}');",'READING_CARD_NO_CREDIT')
 grant('101');unlock(selected)
 ok(sql('select count(*) from public.reading_card_purchases where not revoked and target_key is not null;')=='1','repurchase after refund grants access again')
 grant('102',environment='Production')
 fails(f"select public.reading_card_unlock('{user(1)}','Sandbox','{'b'*64}','couple:year:2027');",'READING_CARD_NO_CREDIT')
 unlock('couple:year:2027','b'*64,environment='Production')
 ok(sql("select target_key from public.reading_card_purchases where transaction_id='102';")=='b'*64,'sandbox and production balances stay separate')
 grant('103')
 fails(f"select public.reading_card_unlock('{user(2)}','Sandbox','{'a'*64}','self:year:2027');",'READING_CARD_NO_CREDIT')
 fails(f"select public.reading_card_unlock('{user(1)}','Sandbox','{'a'*64}','self:year:2026');",'READING_CARD_TARGET_INVALID')
 fails(f"set role authenticated; select * from public.reading_card_purchases;",'permission denied')
 fails(f"set role authenticated; select public.reading_card_grant('{user(1)}','Sandbox','900',now(),1,false);",'permission denied')
 fails(f"set role authenticated; select public.reading_card_unlock('{user(1)}','Sandbox','{'a'*64}','self:year:2027');",'permission denied')
 print('ALL READING CARD DATABASE CHECKS PASSED',flush=True)
finally:
 if started:run([str(binpath/'pg_ctl'),'-D',str(cluster),'-m','immediate','-w','stop'])
