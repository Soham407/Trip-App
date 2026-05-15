alter table public.trip_members
add column if not exists trip_role text not null default 'member'
check (trip_role in ('primary-admin', 'trip-admin', 'member'));

update public.trip_members tm
set trip_role = 'primary-admin'
from public.trips t
join public.app_users au on au.id = t.created_by_user_id
where tm.trip_id = t.id
  and lower(tm.email) = lower(au.email);

create table if not exists public.trip_categories (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  label text not null,
  parent_category_id text,
  sync_status public.sync_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  unique (trip_id, parent_category_id, label)
);

create index if not exists trip_categories_trip_created_at_idx
on public.trip_categories (trip_id, created_at desc);

alter table public.trip_categories enable row level security;

grant select, insert, update, delete on public.trip_categories to authenticated;

create policy "trip_categories_member_access"
on public.trip_categories
for all
to authenticated
using (public.requester_can_access_trip(trip_id))
with check (public.requester_can_access_trip(trip_id));

alter publication supabase_realtime add table public.trip_categories;
