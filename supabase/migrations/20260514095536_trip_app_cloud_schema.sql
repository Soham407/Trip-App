create type public.auth_provider as enum ('google');
create type public.sync_status as enum ('pending', 'synced', 'failed');
create type public.trip_status as enum ('active', 'archived');
create type public.invite_status as enum ('pending', 'accepted');
create type public.trip_list_kind as enum ('shopping', 'packing');
create type public.ledger_entry_status as enum ('categorized', 'imported-uncategorized');
create type public.ledger_entry_source as enum ('manual', 'email', 'webhook');
create type public.ledger_entry_sync_status as enum ('pending', 'synced');
create type public.ledger_activity_type as enum (
  'manual-cash-entry-added',
  'manual-entry-sync-confirmed',
  'imported-entry-categorized',
  'imported-entry-uncategorized',
  'soft-delete',
  'hard-delete'
);

create table public.app_users (
  id text primary key,
  email text not null unique,
  display_name text not null,
  provider public.auth_provider not null default 'google',
  supabase_auth_user_id uuid unique,
  created_at timestamptz not null default timezone('utc', now())
);

create table public.family_groups (
  id text primary key,
  name text not null,
  owner_user_id text not null references public.app_users(id) on delete cascade,
  created_at timestamptz not null,
  sync_status public.sync_status not null default 'pending'
);

create table public.family_group_members (
  id text primary key,
  family_group_id text not null references public.family_groups(id) on delete cascade,
  display_name text not null,
  email text not null,
  created_at timestamptz not null default timezone('utc', now()),
  unique (family_group_id, email)
);

create table public.trips (
  id text primary key,
  destination text not null,
  starts_on date not null,
  ends_on date not null,
  currency text not null default 'INR' check (currency = 'INR'),
  status public.trip_status not null default 'active',
  created_by_user_id text not null references public.app_users(id) on delete restrict,
  created_at timestamptz not null,
  source_family_group_id text references public.family_groups(id) on delete set null,
  source_trip_id text references public.trips(id) on delete set null,
  sync_status public.sync_status not null default 'pending',
  check (ends_on >= starts_on)
);

create table public.trip_members (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  display_name text not null,
  email text not null,
  invite_status public.invite_status not null default 'pending',
  invited_by_user_id text not null references public.app_users(id) on delete restrict,
  invite_token text not null unique,
  sync_status public.sync_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  unique (trip_id, email)
);

create table public.trip_lists (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  kind public.trip_list_kind not null,
  title text not null,
  sync_status public.sync_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  unique (trip_id, kind, title)
);

create table public.trip_list_items (
  id text primary key,
  list_id text not null references public.trip_lists(id) on delete cascade,
  label text not null,
  checked boolean not null default false,
  sync_status public.sync_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now())
);

create table public.ledger_entries (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  label text not null,
  amount numeric(12, 2) not null check (amount > 0),
  paid_by text not null,
  created_at timestamptz not null,
  category_parent_id text,
  category_subcategory_id text,
  status public.ledger_entry_status not null,
  source public.ledger_entry_source not null,
  sync_status public.ledger_entry_sync_status not null default 'pending',
  is_cash boolean not null default false,
  deleted_at timestamptz,
  deleted_by_trip_member_id text references public.trip_members(id) on delete set null,
  updated_by_trip_member_id text references public.trip_members(id) on delete set null
);

create table public.ledger_activities (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  ledger_entry_id text references public.ledger_entries(id) on delete set null,
  acting_trip_member_id text not null references public.trip_members(id) on delete restrict,
  type public.ledger_activity_type not null,
  message text not null,
  created_at timestamptz not null
);

create table public.failed_expense_ingestion_logs (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  source public.ledger_entry_source not null,
  raw_payload text not null,
  reason text not null,
  created_at timestamptz not null,
  sync_status public.sync_status not null default 'pending',
  check (source in ('email', 'webhook'))
);

create table public.ledger_edit_locks (
  id text primary key,
  trip_id text not null references public.trips(id) on delete cascade,
  ledger_entry_id text not null references public.ledger_entries(id) on delete cascade,
  acting_trip_member_id text not null references public.trip_members(id) on delete cascade,
  acquired_at timestamptz not null,
  expires_at timestamptz not null,
  unique (ledger_entry_id),
  check (expires_at > acquired_at)
);

create index trip_members_email_idx on public.trip_members (email);
create index family_group_members_email_idx on public.family_group_members (email);
create index ledger_entries_trip_created_at_idx on public.ledger_entries (trip_id, created_at desc);
create index ledger_activities_trip_created_at_idx on public.ledger_activities (trip_id, created_at desc);
create index trip_list_items_list_id_idx on public.trip_list_items (list_id);
create index failed_logs_trip_created_at_idx on public.failed_expense_ingestion_logs (trip_id, created_at desc);

create or replace function public.requester_email()
returns text
language sql
stable
as $$
  select nullif(lower(coalesce(auth.jwt() ->> 'email', '')), '');
$$;

create or replace function public.requester_can_access_family_group(target_family_group_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.family_groups fg
    left join public.family_group_members fgm on fgm.family_group_id = fg.id
    left join public.app_users au on au.id = fg.owner_user_id
    where fg.id = target_family_group_id
      and public.requester_email() is not null
      and (
        lower(au.email) = public.requester_email()
        or lower(fgm.email) = public.requester_email()
      )
  );
$$;

create or replace function public.requester_can_access_trip(target_trip_id text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.trips t
    left join public.app_users au on au.id = t.created_by_user_id
    left join public.trip_members tm on tm.trip_id = t.id
    where t.id = target_trip_id
      and public.requester_email() is not null
      and (
        lower(au.email) = public.requester_email()
        or lower(tm.email) = public.requester_email()
      )
  );
$$;

alter table public.app_users enable row level security;
alter table public.family_groups enable row level security;
alter table public.family_group_members enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.trip_lists enable row level security;
alter table public.trip_list_items enable row level security;
alter table public.ledger_entries enable row level security;
alter table public.ledger_activities enable row level security;
alter table public.failed_expense_ingestion_logs enable row level security;
alter table public.ledger_edit_locks enable row level security;

grant select, insert, update on public.app_users to authenticated;
grant select, insert, update, delete on public.family_groups to authenticated;
grant select, insert, update, delete on public.family_group_members to authenticated;
grant select, insert, update, delete on public.trips to authenticated;
grant select, insert, update, delete on public.trip_members to authenticated;
grant select, insert, update, delete on public.trip_lists to authenticated;
grant select, insert, update, delete on public.trip_list_items to authenticated;
grant select, insert, update, delete on public.ledger_entries to authenticated;
grant select, insert, update, delete on public.ledger_activities to authenticated;
grant select, insert, update, delete on public.failed_expense_ingestion_logs to authenticated;
grant select, insert, update, delete on public.ledger_edit_locks to authenticated;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on function public.requester_email() to authenticated, service_role;
grant execute on function public.requester_can_access_family_group(text) to authenticated, service_role;
grant execute on function public.requester_can_access_trip(text) to authenticated, service_role;

create policy "app_users_select_self"
on public.app_users
for select
to authenticated
using (lower(email) = public.requester_email());

create policy "app_users_insert_self"
on public.app_users
for insert
to authenticated
with check (lower(email) = public.requester_email());

create policy "app_users_update_self"
on public.app_users
for update
to authenticated
using (lower(email) = public.requester_email())
with check (lower(email) = public.requester_email());

create policy "family_groups_member_access"
on public.family_groups
for all
to authenticated
using (public.requester_can_access_family_group(id))
with check (public.requester_can_access_family_group(id) or owner_user_id in (
  select id from public.app_users where lower(email) = public.requester_email()
));

create policy "family_group_members_member_access"
on public.family_group_members
for all
to authenticated
using (public.requester_can_access_family_group(family_group_id))
with check (public.requester_can_access_family_group(family_group_id));

create policy "trips_member_access"
on public.trips
for all
to authenticated
using (public.requester_can_access_trip(id))
with check (
  public.requester_can_access_trip(id)
  or created_by_user_id in (
    select id from public.app_users where lower(email) = public.requester_email()
  )
);

create policy "trip_members_member_access"
on public.trip_members
for all
to authenticated
using (public.requester_can_access_trip(trip_id))
with check (public.requester_can_access_trip(trip_id));

create policy "trip_lists_member_access"
on public.trip_lists
for all
to authenticated
using (public.requester_can_access_trip(trip_id))
with check (public.requester_can_access_trip(trip_id));

create policy "trip_list_items_member_access"
on public.trip_list_items
for all
to authenticated
using (
  exists (
    select 1
    from public.trip_lists tl
    where tl.id = list_id
      and public.requester_can_access_trip(tl.trip_id)
  )
)
with check (
  exists (
    select 1
    from public.trip_lists tl
    where tl.id = list_id
      and public.requester_can_access_trip(tl.trip_id)
  )
);

create policy "ledger_entries_member_access"
on public.ledger_entries
for all
to authenticated
using (public.requester_can_access_trip(trip_id))
with check (public.requester_can_access_trip(trip_id));

create policy "ledger_activities_member_access"
on public.ledger_activities
for all
to authenticated
using (public.requester_can_access_trip(trip_id))
with check (public.requester_can_access_trip(trip_id));

create policy "failed_logs_member_access"
on public.failed_expense_ingestion_logs
for all
to authenticated
using (public.requester_can_access_trip(trip_id))
with check (public.requester_can_access_trip(trip_id));

create policy "ledger_locks_member_access"
on public.ledger_edit_locks
for all
to authenticated
using (public.requester_can_access_trip(trip_id))
with check (public.requester_can_access_trip(trip_id));

alter publication supabase_realtime add table public.family_groups;
alter publication supabase_realtime add table public.family_group_members;
alter publication supabase_realtime add table public.trips;
alter publication supabase_realtime add table public.trip_members;
alter publication supabase_realtime add table public.trip_lists;
alter publication supabase_realtime add table public.trip_list_items;
alter publication supabase_realtime add table public.ledger_entries;
alter publication supabase_realtime add table public.ledger_activities;
alter publication supabase_realtime add table public.failed_expense_ingestion_logs;
alter publication supabase_realtime add table public.ledger_edit_locks;

insert into public.app_users (id, email, display_name, provider, created_at)
values
  ('user-owner-001', 'parent@example.com', 'Parent', 'google', '2026-01-01T00:00:00Z')
on conflict (id) do nothing;

insert into public.family_groups (id, name, owner_user_id, created_at, sync_status)
values
  ('family-group-001', 'Primary Family', 'user-owner-001', '2026-01-01T00:00:01Z', 'synced')
on conflict (id) do nothing;

insert into public.family_group_members (id, family_group_id, display_name, email, created_at)
values
  ('group-member-001', 'family-group-001', 'Soham', 'soham@example.com', '2026-01-01T00:00:01Z'),
  ('group-member-002', 'family-group-001', 'Ava', 'ava@example.com', '2026-01-01T00:00:01Z'),
  ('group-member-003', 'family-group-001', 'Liam', 'liam@example.com', '2026-01-01T00:00:01Z'),
  ('group-member-004', 'family-group-001', 'Nora', 'nora@example.com', '2026-01-01T00:00:01Z')
on conflict (id) do nothing;

insert into public.trips (
  id,
  destination,
  starts_on,
  ends_on,
  currency,
  status,
  created_by_user_id,
  created_at,
  source_family_group_id,
  source_trip_id,
  sync_status
)
values
  ('trip-active-001', 'Goa', '2026-06-12', '2026-06-19', 'INR', 'active', 'user-owner-001', '2026-01-01T00:00:02Z', 'family-group-001', null, 'synced'),
  ('trip-archive-001', 'Jaipur', '2025-11-05', '2025-11-10', 'INR', 'archived', 'user-owner-001', '2025-11-01T00:00:02Z', 'family-group-001', null, 'synced')
on conflict (id) do nothing;

insert into public.trip_members (
  id,
  trip_id,
  display_name,
  email,
  invite_status,
  invited_by_user_id,
  invite_token,
  sync_status,
  created_at
)
values
  ('trip-member-seed-1', 'trip-active-001', 'Soham', 'soham@example.com', 'accepted', 'user-owner-001', 'invite-seed-1', 'synced', '2026-01-01T00:00:03Z'),
  ('trip-member-seed-2', 'trip-active-001', 'Ava', 'ava@example.com', 'accepted', 'user-owner-001', 'invite-seed-2', 'synced', '2026-01-01T00:00:03Z'),
  ('trip-member-seed-3', 'trip-active-001', 'Liam', 'liam@example.com', 'accepted', 'user-owner-001', 'invite-seed-3', 'synced', '2026-01-01T00:00:03Z'),
  ('trip-member-seed-4', 'trip-active-001', 'Nora', 'nora@example.com', 'accepted', 'user-owner-001', 'invite-seed-4', 'synced', '2026-01-01T00:00:03Z'),
  ('trip-member-archive-1', 'trip-archive-001', 'Soham', 'soham@example.com', 'accepted', 'user-owner-001', 'invite-archive-1', 'synced', '2025-11-01T00:00:03Z'),
  ('trip-member-archive-2', 'trip-archive-001', 'Ava', 'ava@example.com', 'accepted', 'user-owner-001', 'invite-archive-2', 'synced', '2025-11-01T00:00:03Z'),
  ('trip-member-archive-3', 'trip-archive-001', 'Liam', 'liam@example.com', 'accepted', 'user-owner-001', 'invite-archive-3', 'synced', '2025-11-01T00:00:03Z'),
  ('trip-member-archive-4', 'trip-archive-001', 'Nora', 'nora@example.com', 'accepted', 'user-owner-001', 'invite-archive-4', 'synced', '2025-11-01T00:00:03Z')
on conflict (id) do nothing;

insert into public.trip_lists (id, trip_id, kind, title, sync_status, created_at)
values
  ('list-shopping-core', 'trip-active-001', 'shopping', 'Shopping', 'synced', '2026-05-01T09:00:00Z'),
  ('list-packing-core', 'trip-active-001', 'packing', 'Packing', 'synced', '2026-05-01T09:00:00Z'),
  ('list-shopping-history', 'trip-archive-001', 'shopping', 'Shopping', 'synced', '2025-11-02T09:00:00Z'),
  ('list-packing-history', 'trip-archive-001', 'packing', 'Packing', 'synced', '2025-11-02T09:00:00Z')
on conflict (id) do nothing;

insert into public.trip_list_items (id, list_id, label, checked, sync_status, created_at)
values
  ('shop-item-001', 'list-shopping-core', 'Sunscreen', false, 'synced', '2026-05-01T09:00:00Z'),
  ('shop-item-002', 'list-shopping-core', 'Snacks', false, 'synced', '2026-05-01T09:00:00Z'),
  ('item-passport', 'list-packing-core', 'Passport', true, 'synced', '2026-05-01T09:00:00Z'),
  ('item-charger', 'list-packing-core', 'Phone charger', false, 'synced', '2026-05-01T09:00:00Z'),
  ('item-adapter', 'list-packing-core', 'Universal adapter', false, 'synced', '2026-05-01T09:00:00Z'),
  ('shop-item-h-001', 'list-shopping-history', 'Sunscreen', true, 'synced', '2025-11-02T09:00:00Z'),
  ('shop-item-h-002', 'list-shopping-history', 'Laundry pods', true, 'synced', '2025-11-02T09:00:00Z'),
  ('pack-item-h-001', 'list-packing-history', 'Rain jacket', true, 'synced', '2025-11-02T09:00:00Z'),
  ('pack-item-h-002', 'list-packing-history', 'Walking shoes', true, 'synced', '2025-11-02T09:00:00Z')
on conflict (id) do nothing;

insert into public.ledger_entries (
  id,
  trip_id,
  label,
  amount,
  paid_by,
  created_at,
  category_parent_id,
  category_subcategory_id,
  status,
  source,
  sync_status,
  is_cash,
  deleted_at,
  deleted_by_trip_member_id,
  updated_by_trip_member_id
)
values
  ('entry-001', 'trip-active-001', 'Konkan toll plaza', 1840.00, 'Soham', '2026-05-01T09:30:00Z', 'transport', 'transit', 'categorized', 'manual', 'synced', false, null, null, null),
  ('entry-002', 'trip-active-001', 'Beach stay deposit', 12000.00, 'Ava', '2026-05-02T14:15:00Z', 'stay', 'deposit', 'categorized', 'manual', 'synced', false, null, null, null)
on conflict (id) do nothing;
