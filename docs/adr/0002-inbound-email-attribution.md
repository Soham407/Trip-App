# ADR 0002: Attribute Inbound Bank Emails by `X-Forwarded-For` Header

## Status

Accepted

## Context

The app ingests bank / UPI / FASTag alerts as imported expenses. Until now this only worked via manual paste into a TextInput. We are wiring an automated path: family members set up Gmail filters that auto-forward their bank emails to a single shared Postmark inbound address; Postmark POSTs the email JSON to a Supabase Edge Function; the function parses and inserts into `ledger_entries`.

Because the inbound address is shared by all family members, the function has to decide **which family member's spending each email represents**. The forwarded email's `From:` header remains the bank, not the family member. So we need another signal.

Three signals were considered:

1. **`X-Forwarded-For` header.** Gmail adds this header when it auto-forwards a message; it contains the email address of the Gmail account that did the forwarding. No setup beyond the forwarding itself.
2. **Plus-addressed inbox per member** (`abc+soham@inbound.postmarkapp.com`). Each family member is given their own plus-suffix at invite time and configures forwarding to that. Postmark surfaces the suffix as `MailboxHash`.
3. **Parsing the email body** for cardholder name or last-4 of card. Bank-format-specific. Brittle.

Per-member inboxes (option 2) require Gmail to verify each suffix separately (Gmail sends a verification code TO each forwarding address before allowing it to be used), doubles or triples the onboarding friction, and ties a code change (provisioning logic) to every new member. Option 3 fails open: any email whose body doesn't include cardholder info is unattributable, and the format varies per bank.

Option 1 is automatic, requires zero additional setup beyond the forwarding that has to happen anyway, and gives a stable identifier we can match against `trip_members.email`.

## Decision

The Edge Function attributes inbound emails by reading the `X-Forwarded-For` header from the Postmark payload and matching it (case-insensitive, trimmed) against `trip_members.email`.

If multiple `trip_members` rows match (the same email is in multiple active trips), the function selects the trip with the largest `created_at` — the same rule the client uses in `getCurrentTripIdentity`. Archived trips are skipped.

If no `trip_members` row matches the forwarder, or if `X-Forwarded-For` is missing entirely, the function logs a warning and returns `200`. The email is dropped. We do **not** write to `failed_expense_ingestion_logs` in this case because the schema requires `trip_id NOT NULL` and we have no trip to attribute to.

## Consequences

- **Onboarding a new family member is zero-code.** They are added to `trip_members` (via whatever invite flow ships later), then set up Gmail forwarding to the shared address. No per-member provisioning, no schema row, no plus-suffix to track.
- **The shared parser stays a pure function.** Attribution lives entirely in the Edge Function; the parser receives a string and returns parsed fields. The client's manual-paste path uses the same parser and supplies its own attribution (current trip member).
- **Forwarders not in `trip_members` are silently dropped.** This is the right policy for B-lite scope — if someone forwards before being invited to a trip, the system can't safely guess where their spending goes. A future "unrouted inbound" surface would require relaxing the schema constraint above.
- **`From:` header is ignored for attribution.** The bank is the `From:` and we never trust it.
- **Gmail-specific.** `X-Forwarded-For` is a Gmail convention. Other providers (Outlook, iCloud) use different headers or none. If we ever support non-Gmail forwarders, we extend the header lookup; the rest of the design is unaffected.
- **Privacy posture.** Family members forwarding bank emails into the system implicitly trust the inbound pipeline. The Edge Function only persists amount, merchant, and timestamp (on parse success) or the raw payload (on parse failure, scoped to their own trip). It does not store the email headers or recipient list beyond what is needed for attribution.

## Notes

If a future ADR adopts plus-addressing or per-member inboxes — e.g. to support multiple inbound addresses per trip, or to support providers that strip `X-Forwarded-For` — this ADR should be superseded, not edited. The shared-inbox-with-header-attribution shape is the spine of the current design; changing it changes every part of the inbound pipeline.
