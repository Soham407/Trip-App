alter type public.ledger_activity_type
add value if not exists 'manual-cash-entry-updated';

delete from public.ledger_edit_locks
where trip_id in ('trip-active-001', 'trip-archive-001');

delete from public.ledger_activities
where trip_id in ('trip-active-001', 'trip-archive-001');

delete from public.failed_expense_ingestion_logs
where trip_id in ('trip-active-001', 'trip-archive-001');

delete from public.ledger_entries
where trip_id in ('trip-active-001', 'trip-archive-001');

delete from public.trip_list_items
where list_id in (
  'list-shopping-core',
  'list-packing-core',
  'list-shopping-history',
  'list-packing-history'
);

delete from public.trip_lists
where id in (
  'list-shopping-core',
  'list-packing-core',
  'list-shopping-history',
  'list-packing-history'
);

delete from public.trip_members
where trip_id in ('trip-active-001', 'trip-archive-001');

delete from public.trips
where id in ('trip-active-001', 'trip-archive-001');

delete from public.family_group_members
where family_group_id = 'family-group-001';

delete from public.family_groups
where id = 'family-group-001';

delete from public.app_users
where id = 'user-owner-001';
