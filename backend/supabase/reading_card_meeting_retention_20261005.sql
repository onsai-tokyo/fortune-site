-- Preserve the meeting year of purchased timelines when a partner is removed.
-- The immutable reading revision retains the original profile ID used in the key.
begin;
alter table public.couple_timeline_settings drop constraint couple_timeline_settings_partner_profile_id_fkey;
alter table public.couple_timeline_settings add constraint couple_timeline_settings_partner_profile_id_fkey
 foreign key (partner_profile_id) references public.partner_profiles(id) on delete set null;
commit;
