-- Metadata-only audit; not a migration. No user rows or secret values.
BEGIN READ ONLY;

SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
ORDER BY schemaname, tablename, policyname;

SELECT n.nspname AS schema, c.relname AS table_name, c.relrowsecurity AS rls,
       c.relforcerowsecurity AS force_rls,
       has_table_privilege('authenticated', c.oid, 'SELECT') AS can_select,
       has_table_privilege('authenticated', c.oid, 'INSERT') AS can_insert,
       has_table_privilege('authenticated', c.oid, 'UPDATE') AS can_update,
       has_table_privilege('authenticated', c.oid, 'DELETE') AS can_delete
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('public', 'storage') AND c.relkind IN ('r', 'p')
ORDER BY n.nspname, c.relname;

SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'authenticated';

SELECT c.relname, a.attname,
       has_column_privilege('authenticated', c.oid, a.attnum, 'INSERT') AS can_insert,
       has_column_privilege('authenticated', c.oid, a.attnum, 'UPDATE') AS can_update
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
JOIN pg_attribute a ON a.attrelid=c.oid
WHERE n.nspname='public' AND c.relkind IN ('r','p') AND a.attnum>0 AND NOT a.attisdropped
AND ((NOT has_table_privilege('authenticated',c.oid,'INSERT') AND has_column_privilege('authenticated',c.oid,a.attnum,'INSERT'))
 OR (NOT has_table_privilege('authenticated',c.oid,'UPDATE') AND has_column_privilege('authenticated',c.oid,a.attnum,'UPDATE')));

SELECT p.proname, p.prorettype::regtype AS return_type,
       CASE WHEN p.prorettype <> 'trigger'::regtype THEN pg_get_functiondef(p.oid) END AS definition
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' AND p.prosecdef
  AND has_function_privilege('authenticated',p.oid,'EXECUTE')
ORDER BY p.proname;

COMMIT;
