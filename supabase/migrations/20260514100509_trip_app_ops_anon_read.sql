grant select on public.trips to anon;
grant select on public.trip_members to anon;
grant select on public.ledger_entries to anon;
grant select on public.trip_lists to anon;
grant select on public.failed_expense_ingestion_logs to anon;

create policy "trips_anon_read_for_ops"
on public.trips
for select
to anon
using (true);

create policy "trip_members_anon_read_for_ops"
on public.trip_members
for select
to anon
using (true);

create policy "ledger_entries_anon_read_for_ops"
on public.ledger_entries
for select
to anon
using (true);

create policy "trip_lists_anon_read_for_ops"
on public.trip_lists
for select
to anon
using (true);

create policy "failed_logs_anon_read_for_ops"
on public.failed_expense_ingestion_logs
for select
to anon
using (true);
