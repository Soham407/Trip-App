-- PostgREST issues INSERT ... RETURNING by default (Prefer: return=representation
-- from supabase-js). Postgres validates the returned row against the SELECT-side
-- of the policy. The original USING clause called requester_can_access_*(id), a
-- SECURITY DEFINER STABLE function that did not consistently see the just-inserted
-- row, so owners were blocked from creating their own root rows.
--
-- The WITH CHECK clause already escaped via the owner-id subquery; this migration
-- mirrors that escape into USING so the post-insert SELECT also passes for the
-- creator.

drop policy if exists "family_groups_member_access" on public.family_groups;
create policy "family_groups_member_access"
on public.family_groups
for all
to authenticated
using (
  public.requester_can_access_family_group(id)
  or owner_user_id in (
    select id from public.app_users where lower(email) = public.requester_email()
  )
)
with check (
  public.requester_can_access_family_group(id)
  or owner_user_id in (
    select id from public.app_users where lower(email) = public.requester_email()
  )
);

drop policy if exists "trips_member_access" on public.trips;
create policy "trips_member_access"
on public.trips
for all
to authenticated
using (
  public.requester_can_access_trip(id)
  or created_by_user_id in (
    select id from public.app_users where lower(email) = public.requester_email()
  )
)
with check (
  public.requester_can_access_trip(id)
  or created_by_user_id in (
    select id from public.app_users where lower(email) = public.requester_email()
  )
);
