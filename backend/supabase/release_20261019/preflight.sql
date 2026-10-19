-- Catalogs only. Production execution requires separate B0 approval.
-- Run with psql -X -qAt -v ON_ERROR_STOP=1 and save stdout INSIDE encryption.
begin read only;
set local search_path = pg_catalog;
set local statement_timeout = '30s';
with wanted_functions(signature) as (values
  ('public.ai_book_grant_web(uuid,text,integer)'),
  ('public.ai_book_order_web(uuid,uuid,uuid,text,text,text,jsonb)'),
  ('public.ai_book_question_begin(uuid,uuid,uuid,text)'),
  ('public.ai_book_question_begin(uuid,uuid,uuid,text,integer,integer)'),
  ('public.ai_book_question_complete(uuid,uuid,text)'),
  ('public.ai_book_question_fail(uuid,uuid)'),
  ('public.delete_partner_reading_saves()')
), wanted_tables(name) as (values
  ('ai_book_grants'), ('ai_book_credits'), ('ai_books'),
  ('partner_profiles'), ('ai_book_questions'), ('reading_saves')
), functions as (
  select w.signature, p.oid, p.proowner, p.proacl,
    jsonb_build_object(
      'signature',w.signature, 'exists',p.oid is not null,
      'definition',case when p.oid is not null then pg_get_functiondef(p.oid) end,
      'owner',pg_get_userbyid(p.proowner),
      'comment',obj_description(p.oid,'pg_proc'),
      'acl',coalesce((select jsonb_agg(jsonb_build_object(
        'grantor',pg_get_userbyid(a.grantor),
        'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
        'privilege',a.privilege_type,'grantable',a.is_grantable
      ) order by a.grantor,a.grantee,a.privilege_type)
      from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a), '[]'::jsonb),
      'acl_is_null',p.proacl is null,
      'incoming_dependencies',coalesce((select jsonb_agg(
        jsonb_build_object('type',d.deptype,'object',pg_describe_object(d.classid,d.objid,d.objsubid))
        order by d.deptype,pg_describe_object(d.classid,d.objid,d.objsubid))
        from pg_depend d where d.refclassid='pg_proc'::regclass and d.refobjid=p.oid), '[]'::jsonb)
    ) as value
  from wanted_functions w left join pg_proc p on p.oid=to_regprocedure(w.signature)
), tables as (
  select w.name, jsonb_build_object(
    'name',w.name,'exists',c.oid is not null,'kind',c.relkind,
    'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
    'columns',coalesce((select jsonb_agg(jsonb_build_object(
      'position',a.attnum,'name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'not_null',a.attnotnull,'default',pg_get_expr(ad.adbin,ad.adrelid),
      'identity',a.attidentity,'generated',a.attgenerated
    ) order by a.attnum) from pg_attribute a
      left join pg_attrdef ad on ad.adrelid=a.attrelid and ad.adnum=a.attnum
      where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),'[]'::jsonb),
    'constraints',coalesce((select jsonb_agg(jsonb_build_object(
      'name',con.conname,'type',con.contype,'definition',pg_get_constraintdef(con.oid,false),
      'validated',con.convalidated,'comment',obj_description(con.oid,'pg_constraint')
    ) order by con.conname) from pg_constraint con where con.conrelid=c.oid),'[]'::jsonb),
    'indexes',coalesce((select jsonb_agg(pg_get_indexdef(i.indexrelid) order by ic.relname)
      from pg_index i join pg_class ic on ic.oid=i.indexrelid where i.indrelid=c.oid),'[]'::jsonb),
    'policies',coalesce((select jsonb_agg(jsonb_build_object(
      'name',pol.polname,'command',pol.polcmd,'permissive',pol.polpermissive,
      'roles',(select jsonb_agg(case when role_id=0 then 'PUBLIC' else pg_get_userbyid(role_id) end
        order by role_id) from unnest(pol.polroles) role_id),
      'using',pg_get_expr(pol.polqual,pol.polrelid),'check',pg_get_expr(pol.polwithcheck,pol.polrelid)
    ) order by pol.polname) from pg_policy pol where pol.polrelid=c.oid),'[]'::jsonb),
    'acl',coalesce((select jsonb_agg(jsonb_build_object(
      'grantor',pg_get_userbyid(a.grantor),
      'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,
      'privilege',a.privilege_type,'grantable',a.is_grantable
    ) order by a.grantor,a.grantee,a.privilege_type)
      from aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a),'[]'::jsonb),
    'triggers',coalesce((select jsonb_agg(jsonb_build_object(
      'name',t.tgname,'definition',pg_get_triggerdef(t.oid,false),'enabled',t.tgenabled,
      'function',t.tgfoid::regprocedure::text,'internal',t.tgisinternal,
      'comment',obj_description(t.oid,'pg_trigger')
    ) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid),'[]'::jsonb)
  ) as value
  from wanted_tables w left join pg_class c on c.oid=to_regclass('public.'||w.name)
)
select jsonb_build_object(
  'format_version',1,
  'captured_at',clock_timestamp(),
  'database',current_database(),
  'server_version',current_setting('server_version'),
  'server_version_num',current_setting('server_version_num')::integer,
  'executor',current_user,
  'constraints',coalesce((select jsonb_agg(jsonb_build_object(
    'name',conname,'definition',pg_get_constraintdef(oid,false),
    'validated',convalidated,'comment',obj_description(oid,'pg_constraint')
  ) order by conname) from pg_constraint
    where conrelid=to_regclass('public.ai_book_grants') and conname in
      ('ai_book_grants_environment_check','ai_book_grants_source_check')),'[]'::jsonb),
  'functions',(select jsonb_agg(value order by signature) from functions),
  'tables',(select jsonb_agg(value order by name) from tables),
  'extensions',(select jsonb_agg(jsonb_build_object(
    'name',e.extname,'version',e.extversion,'schema',n.nspname,'owner',pg_get_userbyid(e.extowner)
  ) order by e.extname) from pg_extension e join pg_namespace n on n.oid=e.extnamespace),
  'foreign_keys_to_partial_scope',coalesce((select jsonb_agg(jsonb_build_object(
    'name',con.conname,'table',con.conrelid::regclass::text,
    'parent',con.confrelid::regclass::text,'definition',pg_get_constraintdef(con.oid,false)
  ) order by con.conrelid::regclass::text,con.conname) from pg_constraint con
    where con.contype='f' and con.conrelid in (
      to_regclass('public.ai_book_grants'),to_regclass('public.ai_book_credits'),
      to_regclass('public.ai_books'),to_regclass('public.partner_profiles'))),'[]'::jsonb)
);
commit;
