begin;

alter table public.partner_profiles
  add column if not exists relationship_label text;

update public.partner_profiles
set relationship_label = case relationship_type
  when 'friend' then '友人'
  when 'family' then '親'
  else 'お付き合い中'
end
where relationship_label is null;

alter table public.partner_profiles
  alter column relationship_label set default 'お付き合い中',
  alter column relationship_label set not null;

commit;
