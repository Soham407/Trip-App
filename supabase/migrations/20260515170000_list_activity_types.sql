alter type public.ledger_activity_type
add value if not exists 'list-item-added';

alter type public.ledger_activity_type
add value if not exists 'list-item-toggled';

alter type public.ledger_activity_type
add value if not exists 'list-item-deleted';
