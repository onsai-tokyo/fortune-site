-- Production READ ONLY, requires separate user approval before execution.
-- No user rows, secrets, or function bodies are returned.
begin transaction read only;
set local statement_timeout = '10s';
select current_setting('server_version') as postgres_version,
  to_regclass('public.web_reading_snapshots') is not null as snapshot_table_exists,
  to_regprocedure('public.web_snapshot_source_owned(uuid,uuid)') is not null as ownership_function_exists,
  to_regprocedure('auth.uid()') is not null as auth_uid_exists,
  to_regprocedure('auth.jwt()') is not null as auth_jwt_exists;
select table_schema, table_name, column_name, data_type, is_nullable
from information_schema.columns
where (table_schema = 'auth' and table_name = 'users' and column_name = 'id')
   or (table_schema = 'public' and table_name in ('reading_conversations','partner_profiles')
       and column_name in ('id','user_id'))
order by table_schema, table_name, ordinal_position;
select n.nspname as schema_name, c.relname as table_name,
       con.conname as constraint_name, pg_get_constraintdef(con.oid) as definition
from pg_constraint con
join pg_class c on c.oid=con.conrelid
join pg_namespace n on n.oid=c.relnamespace
where con.contype in ('p','u')
  and ((n.nspname='auth' and c.relname='users')
    or (n.nspname='public' and c.relname in ('reading_conversations','partner_profiles')))
order by 1,2,3;
rollback;
