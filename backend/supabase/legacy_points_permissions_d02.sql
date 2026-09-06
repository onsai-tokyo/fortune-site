-- After supabase_migration.sql. Local validation only; requires coordinated backend rollout.
begin;
create or replace function public.deduct_points(target_user_id uuid,cost integer)
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare new_balance integer;
begin
 if target_user_id is null or cost is null or cost<=0 then raise exception 'invalid_point_debit'; end if;
 update public.user_points set balance=balance-cost,updated_at=now()
 where user_id=target_user_id and balance>=cost returning balance into new_balance;
 if not found then
   if not exists(select 1 from public.user_points where user_id=target_user_id) then raise exception 'points_dependency_missing'; end if;
   return -1;
 end if;
 return new_balance;
end $$;
create or replace function public.add_points(target_user_id uuid,amount integer)
returns integer language plpgsql security definer set search_path=pg_catalog,public as $$
declare new_balance integer;
begin
 if target_user_id is null or amount is null or amount<=0 then raise exception 'invalid_point_credit'; end if;
 insert into public.user_points(user_id,balance,total_earned) values(target_user_id,amount,amount)
 on conflict(user_id) do update set balance=public.user_points.balance+excluded.balance,
 total_earned=public.user_points.total_earned+excluded.total_earned,updated_at=now()
 returning balance into new_balance;
 return new_balance;
end $$;
revoke all on function public.deduct_points(uuid,integer) from public,anon,authenticated;
revoke all on function public.add_points(uuid,integer) from public,anon,authenticated;
grant execute on function public.deduct_points(uuid,integer) to service_role;
grant execute on function public.add_points(uuid,integer) to service_role;
-- Preserve the existing owner SELECT policy; deny client-side mutations, including TRUNCATE.
revoke insert,update,delete,truncate,references,trigger on public.user_points from public,anon,authenticated;
grant select on public.user_points to authenticated;
commit;
