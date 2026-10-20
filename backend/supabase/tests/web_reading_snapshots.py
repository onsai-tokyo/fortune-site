"""Synthetic-only RLS checks using official Supabase initialization; no network."""
import argparse
import pathlib
import sys
import tempfile

base = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(base / "release_20261019"))
from matched_runtime import MatchedDatabase

parser = argparse.ArgumentParser()
parser.add_argument("--runtime", type=pathlib.Path, required=True)
args = parser.parse_args()
root = pathlib.Path(tempfile.mkdtemp(prefix="fatelab-snapshot-rls-", dir="/private/tmp"))
db = MatchedDatabase(args.runtime, root)
A = "10000000-0000-4000-8000-000000000001"
B = "10000000-0000-4000-8000-000000000002"
S = "20000000-0000-4000-8000-000000000001"
T = "20000000-0000-4000-8000-000000000002"
P = "30000000-0000-4000-8000-000000000001"
Q = "30000000-0000-4000-8000-000000000002"


def as_user(user, query, anonymous=False):
    claim = "true" if anonymous else "false"
    return db.sql(f"""begin;
      set local role authenticated;
      select set_config('request.jwt.claim.sub','{user}',true);
      select set_config('request.jwt.claims',
        '{{"sub":"{user}","role":"authenticated","is_anonymous":{claim}}}',true);
      {query}
      rollback;""")


def insert(user=A, source=S, partner="null", hashchar="a"):
    return f"""insert into public.web_reading_snapshots
      (user_id,source_id,partner_id,content_hash,payload)
      values ('{user}','{source}',{partner},repeat('{hashchar}',64),'{{"title":"synthetic"}}');"""


def deny(query, user=A, anonymous=False, code="42501"):
    # Catch only the exact expected SQLSTATE, rather than accepting any failure.
    as_user(user, f"""do $test$ begin
      begin {query}
      exception when sqlstate '{code}' then return; end;
      raise exception 'EXPECTED_DENIAL_NOT_SEEN';
      end $test$;""", anonymous)


def check(query, label):
    if db.sql(query).strip() != b"t":
        raise AssertionError(label)
    print("PASS", label, flush=True)


try:
    db.start()
    # Auth-service migration absent from database-only bootstrap. Exact upstream
    # function, namespace template resolved to auth (not a guessed substitute):
    # https://github.com/supabase/auth/blob/master/migrations/20220531120530_add_auth_jwt_function.up.sql
    db.sql("""create or replace function auth.jwt() returns jsonb
      language sql stable as $$
      select coalesce(nullif(current_setting('request.jwt.claim', true), ''),
                      nullif(current_setting('request.jwt.claims', true), ''))::jsonb
      $$;""")
    db.sql(f"""
      create table public.reading_conversations(id uuid primary key,user_id uuid references auth.users);
      create table public.partner_profiles(id uuid primary key,user_id uuid references auth.users);
      revoke all on public.reading_conversations,public.partner_profiles from anon,authenticated;
      insert into auth.users(id) values ('{A}'),('{B}');
      insert into public.reading_conversations values ('{S}','{A}'),('{T}','{B}');
      insert into public.partner_profiles values ('{P}','{A}'),('{Q}','{B}');
    """)
    migration = (base / "web_reading_snapshots_20261021.sql").read_text()
    db.sql(migration)
    as_user(A, insert())
    print("PASS linked owner can insert without source-table SELECT grants", flush=True)
    deny(insert(), anonymous=True)
    deny(insert(user=B))
    deny(insert(source=T))
    deny(insert(partner=f"'{Q}'"))
    deny("perform set_config('request.jwt.claims','{}',true);" + insert())
    print("PASS anonymous / forged owner / foreign source / foreign partner rejected", flush=True)
    db.sql(insert() + insert(partner=f"'{P}'", hashchar="b"))
    as_user(B, """do $$ begin
      if exists(select 1 from public.web_reading_snapshots) then
        raise exception 'CROSS_ACCOUNT_READ'; end if;
      delete from public.web_reading_snapshots;
      if found then raise exception 'CROSS_ACCOUNT_DELETE'; end if;
      end $$;""")
    deny("update public.web_reading_snapshots set payload='{}';")
    as_user(A, """do $$ declare n integer; begin
      select count(*) into n from public.web_reading_snapshots;
      if n<>2 then raise exception 'OWNER_READ_FAILED'; end if;
      delete from public.web_reading_snapshots;
      get diagnostics n = row_count;
      if n<>2 then raise exception 'OWNER_DELETE_FAILED'; end if;
      end $$;""")
    print("PASS owner delete, cross-account isolation and immutable payload", flush=True)
    as_user(A, insert().replace(";", " on conflict(user_id,content_hash) do nothing;") +
            """do $$ begin
            if (select count(*) from public.web_reading_snapshots)<>2 then
              raise exception 'DUPLICATE_CREATED'; end if; end $$;""")
    check("select count(*)=2 from public.web_reading_snapshots;", "retry does not duplicate")
    db.sql(f"delete from public.partner_profiles where id='{P}';")
    check("select count(*)=1 from public.web_reading_snapshots;", "partner delete removes only coupled snapshot")
    db.sql(f"delete from public.reading_conversations where id='{S}';")
    check("select count(*)=1 and bool_and(source_id is null) from public.web_reading_snapshots;",
          "source delete preserves saved text")
    db.sql(f"delete from auth.users where id='{A}';")
    check("select count(*)=0 from public.web_reading_snapshots;", "account deletion cascades")
    print("SNAPSHOT_RLS_SYNTHETIC_OK", flush=True)
finally:
    if not db.stop():
        raise RuntimeError("LOCAL_SERVER_STOP_FAILED")
    print("LOCAL_SERVER_STOPPED", flush=True)
