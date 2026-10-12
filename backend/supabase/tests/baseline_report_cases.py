# Run only inside books_postgrest.py's disposable, local PostgreSQL cluster.
import json
report_path=base.parent.parent/'docs/first-book-free-20261012/baseline_report.sql'
def metric_user(n):return f'66666666-6666-4666-8666-{n:012d}'
def metric_event(n,event,at,properties=None):
    user=metric_user(n)
    payload=json.dumps(properties or {}).replace("'","''")
    sql(f"insert into product_events(user_id,event,event_key,origin,occurred_at,properties) values('{user}','{event}',gen_random_uuid()::text,'server','{at}','{payload}'::jsonb);")
for n in range(1,9):sql(f"insert into auth.users(id) values('{metric_user(n)}');")
for n in [1,2,3,5]:metric_event(n,'registration_completed','2026-11-01 00:05:00+09',{'trialEnabled':False})
metric_event(4,'registration_completed','2026-11-09 12:00:00+09',{'trialEnabled':True})
metric_event(6,'registration_completed','2026-10-31 23:59:59+09',{'trialEnabled':False})
metric_event(7,'registration_completed','2026-11-01 00:05:00+09',{'trialEnabled':True})
metric_event(8,'registration_completed','2026-11-01 00:05:00+09')
for event in ['timeline_viewed']*4+['book_create_tapped','paywall_viewed']:
    metric_event(1,event,'2026-11-02 00:00:00+09')
for _ in range(2):metric_event(1,'purchase_completed','2026-11-02 01:00:00+09',{'environment':'Production'})
metric_event(2,'purchase_completed','2026-11-02 01:00:00+09',{'environment':'Sandbox'})
metric_event(3,'purchase_completed','2026-10-30 01:00:00+09',{'environment':'Production'})
metric_event(4,'purchase_completed','2026-11-09 13:00:00+09',{'environment':'Production'})
metric_event(5,'purchase_completed','2026-11-02 01:00:00+09',{'environment':'Production'})
sql(f"delete from auth.users where id='{metric_user(5)}';")
metric_event(7,'purchase_completed','2026-11-08 00:05:00+09',{'environment':'Production'})
query=report_path.read_text().replace('now() AS as_of',"timestamptz '2026-11-10 00:00:00+09' AS as_of")
rows=[row.split('|') for row in sql(query).splitlines()]
by_cohort={(row[0],row[1]):row[2:] for row in rows}
assert len(rows)==4,rows
off=by_cohort['2026-11-01','off']
assert off==['3','3','1','1','1','1','0','0','0','33.33'],off
print('PASS BASELINE REPORT: unique people; Sandbox/old restore/deleted users excluded',flush=True)
recent=by_cohort['2026-11-09','on']
assert recent[0:2]==['1','0'] and recent[5]=='1' and recent[-1]=='',recent
print('PASS BASELINE REPORT: incomplete observation windows never dilute conversion rate',flush=True)
assert by_cohort['2026-11-01','on'][5]=='0',rows
assert ('2026-10-31','off') not in by_cohort,rows
print('PASS BASELINE REPORT: JST registration boundary and exclusive seven-day window',flush=True)
assert by_cohort['2026-11-01','unknown'][0]=='1',rows
print('PASS BASELINE REPORT: missing trial setting is unknown, not silently OFF',flush=True)
