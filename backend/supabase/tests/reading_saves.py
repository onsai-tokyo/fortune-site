"""Disposable PostgreSQL checks for Web reading save keys."""
import os, pathlib, subprocess, tempfile

base = pathlib.Path(__file__).resolve().parents[1]
binpath = pathlib.Path(os.environ['BOOKS_PG_BIN'])
root = pathlib.Path(tempfile.mkdtemp(prefix='fatelab-reading-saves-', dir='/private/tmp'))
cluster, socket = root / 'data', root / 'socket'
socket.mkdir()
env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}

def command(args, **kwargs):
    p = subprocess.run(args, env=env, text=True, capture_output=True, **kwargs)
    if p.returncode:
        raise RuntimeError(p.stderr)
    return p.stdout.strip()

def sql(query):
    return command([
        '/opt/homebrew/opt/libpq/bin/psql', '-X', '-qAt', '-v',
        'ON_ERROR_STOP=1', '-h', str(socket), '-p', '55479',
        '-U', 'postgres', '-d', 'postgres',
    ], input=query)

def expect(condition, message):
    if not condition:
        raise AssertionError(message)
    print('PASS', message, flush=True)

def fails(query, needle):
    try:
        sql(query)
    except RuntimeError as error:
        return needle in str(error)
    return False

started = False
try:
    command([str(binpath / 'initdb'), '-D', str(cluster), '--no-locale', '--encoding=UTF8', '-A', 'trust', '-U', 'postgres'])
    command([
        str(binpath / 'pg_ctl'), '-D', str(cluster), '-l', str(root / 'pg.log'),
        '-o', f"-F -k {socket} -p 55479 -c listen_addresses=''", '-w', 'start',
    ])
    started = True
    sql("""
      create role anon;
      create role authenticated;
      create role service_role bypassrls;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
      create table public.partner_profiles(id uuid primary key, user_id uuid not null references auth.users(id) on delete cascade);
    """)
    sql((base / 'reading_saves_20261017.sql').read_text())
    user = '00000001-2222-4222-8222-222222222222'
    sql(f"insert into auth.users values ('{user}'); insert into public.reading_saves(user_id, save_key) values ('{user}', 'you-2026'), ('{user}', 'chapter-ch-1'), ('{user}', 'couple-11111111-1111-4111-8111-111111111111-2026');")
    expect(sql(f"select count(*) from public.reading_saves where user_id='{user}';") == '3', 'all Web save key shapes are accepted')
    sql(f"insert into public.reading_saves(user_id, save_key) values ('{user}', 'chapter-ch-1') on conflict (user_id, save_key) do update set updated_at=now();")
    expect(sql(f"select count(*) from public.reading_saves where user_id='{user}' and save_key='chapter-ch-1';") == '1', 'save key upsert does not duplicate a saved reading')
    expect(fails(f"insert into public.reading_saves(user_id, save_key) values ('{user}', 'invalid-key');", 'reading_saves_save_key_check'), 'invalid save key is rejected')
    partner = '11111111-1111-4111-8111-111111111111'
    sql(f"insert into public.partner_profiles values ('{partner}', '{user}'); insert into public.reading_saves(user_id, save_key) values ('{user}', 'couple-{partner}-2027'), ('{user}', 'couple-{partner}-2028'), ('{user}', 'you-2027'); delete from public.partner_profiles where id='{partner}';")
    expect(sql(f"select count(*) from public.reading_saves where user_id='{user}' and save_key like 'couple-{partner}-%';") == '0', 'partner deletion removes that partner\'s saved readings')
    sql(f"insert into public.reading_saves(user_id, save_key) values ('{user}', 'chapter-before-delete'); delete from auth.users where id='{user}';")
    expect(sql(f"select count(*) from public.reading_saves where user_id='{user}';") == '0', 'account deletion cascades all saved readings')
    print('ALL READING SAVE DATABASE CHECKS PASSED', flush=True)
finally:
    if started:
        command([str(binpath / 'pg_ctl'), '-D', str(cluster), '-m', 'immediate', '-w', 'stop'])
