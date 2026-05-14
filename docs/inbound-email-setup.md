# Inbound Email Setup (Option B — Postmark Webhook)

Runbook for routing bank / UPI alerts from Gmail into the Trip App as imported expenses.

**Status:** Code not yet built. This document captures the design and the manual steps you'll run **after** the webhook is shipped.

**Decision (May 14 2026):** Ship as **B-lite** for the May 18 trip — only Soham's Gmail forwards on day one. Family members opt in later with zero code changes.

---

## How it works (architecture)

```
Bank → Gmail (family member) → Gmail filter → Auto-forward
                                                     ↓
                          abc123@inbound.postmarkapp.com (Postmark inbound)
                                                     ↓
                                  Postmark POSTs JSON to webhook
                                                     ↓
                          Supabase Edge Function: parse-inbound-email
                                                     ↓
              X-Forwarded-For header → lookup in trip_members.email
                                                     ↓
                          Existing regex parser (parseImportedExpensePayload)
                                                     ↓
                  Insert into ledger_entries (status = imported-uncategorized)
                          OR failed_expense_ingestion_logs on parse failure
```

The mobile app's existing realtime subscription (once wired) shows the new row instantly. Until realtime is wired, pull-to-refresh / reopen.

---

## What Option B requires (reference)

To make a shared inbox attribute correctly:

1. **One Postmark inbound address** (free, no domain needed — e.g. `abc123@inbound.postmarkapp.com`).
2. **Each family member sets up Gmail auto-forwarding** to that address. Gmail requires a one-time verification per forwarder: Gmail sends a code TO the forwarding address, the code lands in Postmark, you fish it out, the family member pastes it back in their Gmail. ~5–10 min per person.
3. **Each family member creates a Gmail filter** matching their bank's alert sender (e.g. `from:alerts@hdfcbank.net`). Otherwise their whole inbox forwards and the webhook gets noise.
4. **The webhook reads the `X-Forwarded-For` header** (Gmail adds this automatically — it contains the email of the family member who forwarded), looks up that email in `trip_members`, and attributes the expense to them.
5. **The existing parser handles 2 formats today** (generic UPI / FASTag). Different banks format alerts differently. Each new bank you encounter will likely need a regex addition; until then, those emails land in `failed_expense_ingestion_logs` and can still be reviewed.

**Total upfront cost:** ~30–40 min with all 4 family members available, plus dev work to build the webhook and tune the parser to real bank email formats.

---

## One-time setup (do once, before May 18)

These are the manual steps after the Edge Function and webhook are deployed. The dev work is tracked separately.

### Step 1 — Create the Postmark account and inbound stream

1. Sign up at https://postmarkapp.com (free tier covers this; inbound is free up to 10k emails/month).
2. Create a server (any name — e.g. `trip-app-inbound`).
3. In the server, go to **Default Inbound Stream**.
4. Note the **inbound address** — it looks like `abc123def456@inbound.postmarkapp.com`. This is the address every family member will forward to.
5. Under **Webhook URL**, paste the deployed Edge Function URL: `https://oyospqalwrambxnfehxr.supabase.co/functions/v1/parse-inbound-email`.
6. Save.

### Step 2 — Configure webhook auth (HTTP Basic Auth)

Postmark does not sign inbound requests by default. The Edge Function gates incoming POSTs with HTTP Basic Auth, with credentials baked into the webhook URL Postmark calls.

1. Pick a username and a long random password (e.g. `openssl rand -hex 24`).
2. In Postmark, set the inbound webhook URL to:
   `https://<user>:<password>@oyospqalwrambxnfehxr.supabase.co/functions/v1/parse-inbound-email`
3. Add the same credentials to Supabase secrets so the function can compare:

   ```sh
   supabase secrets set INBOUND_WEBHOOK_USER=<user>
   supabase secrets set INBOUND_WEBHOOK_PASSWORD=<password>
   ```

4. The Edge Function reads the `Authorization: Basic …` header on every request and returns `401` if it doesn't match. Treat the full URL as a secret; rotate the password if it ever leaks.

### Step 3 — Set up forwarding from your own Gmail (B-lite scope)

In your personal Gmail (the one used to sign into the Trip App):

1. **Settings → See all settings → Forwarding and POP/IMAP → Add a forwarding address.**
2. Paste the Postmark inbound address from Step 1.
3. Gmail sends a verification code to that address. The code is now sitting in Postmark.
4. Check the code: open the Postmark dashboard → **Activity** → the most recent inbound message → copy the code from the email body.
5. Back in Gmail, paste the code. Gmail confirms.
6. **Do NOT** select "Forward a copy of incoming mail" globally — that would forward everything.
7. Go to **Settings → Filters and Blocked Addresses → Create a new filter.**
8. In **From**, enter the sender pattern for your bank's alerts. Common examples:
   - HDFC credit card alerts: `alerts@hdfcbank.net`
   - HDFC UPI: `alerts@hdfcbank.com`
   - ICICI: `credit_cards@icicibank.com`
   - SBI: `donotreply.sbiatm@alerts.sbi.co.in`
   - Axis: `alerts@axisbank.com`
   - GPay: `googlepay-noreply@google.com`
   - PhonePe: `alerts@phonepe.com`
   - FASTag (NHAI): varies by issuer
   - Find yours by searching your inbox for a known recent transaction; copy the `From` address exactly.
9. Click **Create filter**.
10. Tick **Forward it to:** `abc123@inbound.postmarkapp.com`.
11. Optionally also tick **Skip the Inbox** and **Apply the label: Trip-App** so your inbox doesn't fill with duplicates.
12. **Create filter.**

### Step 4 — Smoke-test with one real alert

1. Make a small UPI payment (₹1 to yourself via GPay works).
2. Within 30 seconds the bank email lands in Gmail and Gmail forwards it.
3. Check Postmark **Activity** — the email should appear.
4. Check Supabase **ledger_entries** (or the `/ops` screen in the app) — a new row with `source = 'email'`, `status = 'imported-uncategorized'` should appear within a few seconds.
5. If it instead landed in `failed_expense_ingestion_logs`, copy the raw payload (visible on `/ops`) and we extend the parser to match.

---

## Adding a family member later (repeatable)

For each new family member (post-May-18 rollout):

1. Make sure they are already invited as a `trip_members` row — the webhook attributes by matching `X-Forwarded-For` against `trip_members.email`. If they're not in the table, the email lands in `failed_expense_ingestion_logs` with reason "unknown forwarder".
2. They follow Step 3 above from their own Gmail.
3. They use the same shared `abc123@inbound.postmarkapp.com` address — there is only ever one inbound address.
4. Smoke-test with a small real payment from their account.

---

## What to do when an alert fails to parse

Failed emails land in `failed_expense_ingestion_logs` and are visible on the **Failed imports** tab of the Ledger screen.

1. Open `/ops` (or query the table directly) and copy the `raw_payload` of the failed row.
2. Identify which bank / format it was.
3. Add a regex branch to `parseImportedExpensePayload` in `data/currentTripStore.ts`, mirroring the patterns already there for UPI and FASTag.
4. Re-deploy. Past failures stay failed (they were already recorded as failed); only new emails of that format will succeed.
5. Optional: build a "retry parsing" button on the Failed imports tab that re-runs the parser against `raw_payload`.

---

## Notes & gotchas

- **Postmark inbound delivery is usually under 2 seconds** but can spike. Don't promise "instant".
- **Gmail's auto-forwarding strips some headers and adds others.** The `X-Forwarded-For` header is the reliable identifier; do not rely on `From:` (it remains the bank, not the forwarder).
- **One Postmark inbound address per Postmark server.** You can have multiple servers if you ever split trips by environment (e.g. staging vs prod), but for now one is enough.
- **Verification code email is single-use and time-limited.** If Gmail asks for re-verification later (e.g. after a long pause), you fish a fresh code out of Postmark.
- **Postmark inbound auth.** Postmark itself does not sign inbound requests by default. The Edge Function should require a shared secret in the URL (e.g. `…/parse-inbound-email?token=XYZ`) or in a header that we configure on the Postmark webhook URL. Treat the webhook URL as a secret.
- **Privacy posture for family members:** they are forwarding bank alert emails to a third-party service (Postmark) and to a database (Supabase) that you control. Get explicit verbal consent before doing Step 3 for someone else. Mention that nothing other than amount, merchant, and timestamp is stored — the raw payload only persists on parse failure.
- **Cost:** Postmark free tier covers 10k inbound emails/month and 100 outbound. A family of 4 generating ~50 alerts/month/person is well under the limit.
- **If you ever stop using this:** delete the Gmail filter first, then delete the Postmark server. The Supabase Edge Function can stay (it just stops receiving requests).

---

## Dev-side work (locked decisions, May 14 2026)

Architectural decisions are resolved. See `docs/adr/0002-inbound-email-attribution.md` for the spine of the design.

### Edge Function

- Path: `supabase/functions/parse-inbound-email/index.ts`.
- Runtime: Deno (Supabase default).
- Auth: HTTP Basic Auth via `Authorization` header, validated against `INBOUND_WEBHOOK_USER` / `INBOUND_WEBHOOK_PASSWORD` secrets. Returns `401` on mismatch.
- Service-role key (`SUPABASE_SERVICE_ROLE_KEY`) is used for the DB client inside the function, bypassing RLS for inserts.

### Parser

- Extract `parseImportedExpensePayload` from `data/currentTripStore.ts:634` into a new module `data/expenseAlertParser.ts` with no client-only imports.
- The Edge Function imports the same file. The client's `ingestSharedExpenseAlert` keeps working unchanged for the manual paste path.
- Do **not** speculate on new bank regexes before May 18. Extend the parser only after seeing real failed payloads from Step 4 of the runbook.

### Attribution algorithm (executed in the Edge Function)

1. Read `X-Forwarded-For` from the Postmark payload's `Headers` array. If missing → log warning, return 200, drop.
2. Lowercase / trim the forwarder email.
3. Query `trip_members` for rows with that email. Join with `trips` filtered to `status = 'active'`.
4. If zero matches → log warning, return 200, drop. (Schema disallows writing to `failed_expense_ingestion_logs` without a trip; that constraint stays.)
5. If multiple matches → pick the trip with the largest `created_at`. Same rule as `getCurrentTripIdentity` on the client.
6. Run the shared parser against the email body.
7. On success: insert into `ledger_entries` with `source = 'email'`, `status = 'imported-uncategorized'`, `sync_status = 'synced'`, `paid_by = <matched member's display_name>`, `updated_by_trip_member_id = <matched member's id>`.
8. On parse failure: insert into `failed_expense_ingestion_logs` with the resolved `trip_id`, `source = 'email'`, raw payload, and the parser's error reason.

### Realtime (client side, ships with this work)

Subscribe two tables, filtered to the current trip:

- `ledger_entries` — dashboard and ledger screens.
- `failed_expense_ingestion_logs` — ledger screen "Failed imports" tab.

Other tables (lists, activity log, members) stay reopen-to-refresh for May 18.

Pattern: create the channel inside the existing `subscribeCurrentTripStore` flow so subscribers update on remote inserts the same way they update on local writes.
