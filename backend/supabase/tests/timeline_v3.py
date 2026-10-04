"""Disposable database only; tests actual RLS, rollback and profile serialization."""
import os,pathlib,subprocess,tempfile,json
base=pathlib.Path(__file__).resolve().parents[1]
binpath=pathlib.Path(os.environ['TIMELINE_PG_BIN'])
root=pathlib.Path(tempfile.mkdtemp(prefix='fatelab-timeline-db-',dir='/private/tmp'));socket=root/'socket';socket.mkdir();cluster=root/'data'
def run(args,**kw):
 p=subprocess.run(args,text=True,capture_output=True,**kw)
 if p.returncode:raise RuntimeError(p.stderr)
 return p.stdout.strip()
def sql(q):return run(['/opt/homebrew/opt/libpq/bin/psql','-X','-qAt','-v','ON_ERROR_STOP=1','-h',str(socket),'-p','55489','-U','postgres','postgres'],input=q)
def uid(n):return f'{n:08d}-1111-4111-8111-111111111111'
def actor(n,q):return sql(f"set role authenticated;set request.jwt.claim.sub='{uid(n)}';"+q)
def check(ok,label):
 assert ok,label
 print('PASS '+label,flush=True)
def rejected(q,label):
 try:actor(1,q)
 except RuntimeError:print('PASS '+label,flush=True);return
 raise AssertionError(label)
started=False
try:
 run([str(binpath/'initdb'),'-D',str(cluster),'--no-locale','--encoding=UTF8','-A','trust','-U','postgres'])
 run([str(binpath/'pg_ctl'),'-D',str(cluster),'-l',str(root/'pg.log'),'-o',f"-F -k {socket} -p 55489 -c listen_addresses=''",'-w','start']);started=True
 sql("create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;")
 sql((base/'timeline_v3_20261004.sql').read_text())
 sql(f"insert into auth.users values ('{uid(1)}'),('{uid(2)}');")
 for n in [1,2]:actor(n,f"insert into timeline_profiles(user_id,birth_data) values ('{uid(n)}','{{\"birthDate\":\"1995-03-16\"}}');")
 actor(1,"select replace_life_events('[{\"year\":2020,\"kind\":\"job\"}]');")
 check(actor(1,'select count(*) from life_events;')=='1','owner reads saved event')
 check(actor(2,'select count(*) from life_events;')=='0','other account cannot read events')
 rejected(f"insert into life_events(user_id,year,kind) values ('{uid(2)}',2020,'job');",'cannot write another account')
 rejected("select replace_life_events('[{\"year\":2021,\"kind\":\"invalid\"}]');",'invalid replacement rejected')
 check(actor(1,'select year from life_events;')=='2020','failed replacement keeps previous events')
 rejected("select replace_life_events(null);",'null replacement cannot delete events')
 rejected("update timeline_profiles set birth_data='{\"birthDate\":\"2000-01-01\"}';",'profile cannot change while events exist')
 actor(1,"update timeline_profiles set relationship_status='single';")
 check(actor(1,'select relationship_status from timeline_profiles;')=='single','relationship status remains editable')
 rejected(f"insert into life_events(user_id,year,kind) values ('{uid(1)}',1990,'job');",'direct write cannot bypass birth year guard')
 check(actor(1,'select count(*) from validation_consents;')=='0','validation consent defaults off')
 actor(1,f"insert into validation_consents(user_id,consented_at) values ('{uid(1)}',now());")
 check(actor(2,'select count(*) from validation_consents;')=='0','consent isolated by owner')
 actor(1,"select replace_life_events('[]');update timeline_profiles set birth_data='{\"birthDate\":\"2000-01-01\"}';")
 check(actor(1,'select count(*) from life_events;')=='0','explicit removal permits profile correction')
 actor(1,"select replace_life_events('[{\"year\":2020,\"kind\":\"job\"}]');")
 sql(f"delete from auth.users where id='{uid(1)}';")
 check(sql('select count(*) from life_events;')=='0','account deletion removes events')
 check(sql('select count(*) from validation_consents;')=='0','account deletion removes consent')
finally:
 if started:run([str(binpath/'pg_ctl'),'-D',str(cluster),'-m','immediate','-w','stop'])
