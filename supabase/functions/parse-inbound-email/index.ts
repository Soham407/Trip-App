// Postmark inbound webhook handler.
//
// Receives a Postmark inbound email JSON payload, identifies which family
// member forwarded it via the X-Forwarded-For header, runs the shared
// regex parser, and inserts the result into ledger_entries (or
// failed_expense_ingestion_logs on parse failure).
//
// See docs/adr/0002-inbound-email-attribution.md for the design rationale
// and docs/inbound-email-setup.md for the operator runbook.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  isParseFailure,
  parseImportedExpensePayload
} from "../_shared/expenseAlertParser.ts";

type PostmarkHeader = { Name: string; Value: string };

type PostmarkInboundPayload = {
  From?: string;
  Subject?: string;
  TextBody?: string;
  HtmlBody?: string;
  Headers?: PostmarkHeader[];
  MessageID?: string;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const WEBHOOK_USER = Deno.env.get("INBOUND_WEBHOOK_USER") ?? "";
const WEBHOOK_PASSWORD = Deno.env.get("INBOUND_WEBHOOK_PASSWORD") ?? "";

function unauthorized(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 401,
    headers: { "Content-Type": "application/json" }
  });
}

function badRequest(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 400,
    headers: { "Content-Type": "application/json" }
  });
}

function ok(body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

function verifyBasicAuth(request: Request): boolean {
  if (!WEBHOOK_USER || !WEBHOOK_PASSWORD) {
    return false;
  }

  const header = request.headers.get("authorization") ?? "";

  if (!header.toLowerCase().startsWith("basic ")) {
    return false;
  }

  try {
    const decoded = atob(header.slice("basic ".length).trim());
    const colon = decoded.indexOf(":");
    if (colon < 0) {
      return false;
    }
    const user = decoded.slice(0, colon);
    const password = decoded.slice(colon + 1);
    return user === WEBHOOK_USER && password === WEBHOOK_PASSWORD;
  } catch {
    return false;
  }
}

function extractForwarderEmail(headers: PostmarkHeader[] | undefined): string | undefined {
  if (!headers) {
    return undefined;
  }

  const xff = headers.find((header) => header.Name.toLowerCase() === "x-forwarded-for");
  const value = xff?.Value?.trim();

  if (!value) {
    return undefined;
  }

  // X-Forwarded-For may contain a comma-separated chain; the first entry is
  // the original recipient (the family member who forwarded).
  const firstEntry = value.split(",")[0]?.trim().toLowerCase();
  return firstEntry || undefined;
}

function nextId(prefix: string): string {
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  return `${prefix}-${random}`;
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return badRequest("only POST is supported");
  }

  if (!verifyBasicAuth(request)) {
    return unauthorized("invalid credentials");
  }

  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    return new Response(
      JSON.stringify({ error: "edge function is not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  let payload: PostmarkInboundPayload;

  try {
    payload = (await request.json()) as PostmarkInboundPayload;
  } catch {
    return badRequest("body is not valid JSON");
  }

  const forwarderEmail = extractForwarderEmail(payload.Headers);

  if (!forwarderEmail) {
    console.warn("inbound email missing X-Forwarded-For; dropping", {
      from: payload.From,
      subject: payload.Subject
    });
    return ok({ status: "dropped", reason: "missing X-Forwarded-For" });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });

  // Find every trip_member row whose email matches the forwarder, joined to
  // active trips, sorted so the most recently created trip wins.
  const { data: candidateMembers, error: lookupError } = await supabase
    .from("trip_members")
    .select("id, trip_id, display_name, email, trips!inner(id, status, created_at)")
    .ilike("email", forwarderEmail)
    .eq("trips.status", "active");

  if (lookupError) {
    console.error("trip_member lookup failed", lookupError);
    return new Response(
      JSON.stringify({ error: "lookup failed" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  if (!candidateMembers || candidateMembers.length === 0) {
    console.warn("no active trip for forwarder; dropping", { forwarderEmail });
    return ok({ status: "dropped", reason: "no active trip for forwarder" });
  }

  const winner = [...candidateMembers].sort((left, right) => {
    const leftCreated = (left.trips as { created_at: string }).created_at;
    const rightCreated = (right.trips as { created_at: string }).created_at;
    return rightCreated.localeCompare(leftCreated);
  })[0];

  const tripId = (winner.trips as { id: string }).id;
  const memberId = winner.id as string;
  const memberDisplayName = winner.display_name as string;

  const body = payload.TextBody ?? payload.HtmlBody ?? "";
  const parsed = parseImportedExpensePayload(body);
  const nowIso = new Date().toISOString();

  if (isParseFailure(parsed)) {
    const { error: insertError } = await supabase
      .from("failed_expense_ingestion_logs")
      .insert({
        id: nextId("expense-failed"),
        trip_id: tripId,
        source: "email",
        raw_payload: body,
        reason: parsed.error,
        created_at: nowIso,
        sync_status: "synced"
      });

    if (insertError) {
      console.error("failed_expense_ingestion_logs insert failed", insertError);
      return new Response(
        JSON.stringify({ error: "failed to record parse failure" }),
        { status: 500, headers: { "Content-Type": "application/json" } }
      );
    }

    return ok({ status: "parse_failed", reason: parsed.error, tripId });
  }

  const { error: insertError } = await supabase.from("ledger_entries").insert({
    id: nextId("entry-import"),
    trip_id: tripId,
    label: parsed.merchant,
    amount: parsed.amount,
    paid_by: memberDisplayName,
    created_at: parsed.timestamp,
    status: "imported-uncategorized",
    source: "email",
    sync_status: "synced",
    is_cash: false,
    updated_by_trip_member_id: memberId
  });

  if (insertError) {
    console.error("ledger_entries insert failed", insertError);
    return new Response(
      JSON.stringify({ error: "failed to record imported expense" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  return ok({
    status: "imported",
    tripId,
    memberId,
    amount: parsed.amount,
    merchant: parsed.merchant,
    timestamp: parsed.timestamp
  });
});
