// Mirror of data/expenseAlertParser.ts (client-side source of truth).
//
// Supabase Edge Functions deploy from this directory, so this file is a
// deliberate duplicate to avoid a relative import outside the function tree
// (which the Supabase bundler does not reliably handle).
//
// If you change parser behavior, edit BOTH files. The tests in
// tests/sharedExpenseReview.test.ts cover the client copy and will surface
// behavioral drift the next time someone runs `npm test`.

export type ParsedExpenseAlert = {
  readonly amount: number;
  readonly merchant: string;
  readonly timestamp: string;
};

export type ExpenseAlertParseFailure = {
  readonly error: string;
};

export type ExpenseAlertParseResult = ParsedExpenseAlert | ExpenseAlertParseFailure;

export function isParseFailure(result: ExpenseAlertParseResult): result is ExpenseAlertParseFailure {
  return "error" in result;
}

function normalizeAlertTimestamp(rawTimestamp: string | undefined): string | null {
  if (!rawTimestamp) {
    return null;
  }

  const normalized = rawTimestamp.trim();

  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}\s\d{2}:\d{2}$/.test(normalized)) {
    return normalized.replace(" ", "T") + ":00Z";
  }

  const parsed = Date.parse(normalized);

  if (Number.isNaN(parsed)) {
    return null;
  }

  return new Date(parsed).toISOString();
}

function parseBankAlert(payload: string): ExpenseAlertParseResult {
  const upiMatch = payload.match(
    /(?:gpay|google\s*pay|upi).*?(?:paid|debited|sent|spent)\s+(?:INR|RS\.?|Rs\.?)\s*([0-9]+(?:\.[0-9]{1,2})?).*?(?:to|at|for)\s+(.+?)\s+(?:on|at)\s+([0-9]{4}-[0-9]{2}-[0-9]{2}(?:[ T][0-9]{2}:[0-9]{2}(?::[0-9]{2})?)?)/i
  );

  if (upiMatch) {
    const amount = Number.parseFloat(upiMatch[1] ?? "NaN");
    const merchant = upiMatch[2]?.trim();
    const timestamp = normalizeAlertTimestamp(upiMatch[3]);

    if (!Number.isFinite(amount)) {
      return { error: "UPI alert amount was not a valid number" };
    }

    if (!merchant) {
      return { error: "UPI alert merchant was empty" };
    }

    if (!timestamp) {
      return { error: "UPI alert timestamp was not parseable" };
    }

    return { amount, merchant, timestamp };
  }

  const bankMatch = payload.match(
    /used at\s+(.+?)\s+on\s+([0-9]{4}-[0-9]{2}-[0-9]{2}(?:[ T][0-9]{2}:[0-9]{2}(?::[0-9]{2})?)?)\s+for\s+(?:INR|RS\.?|Rs\.?)\s*([0-9]+(?:\.[0-9]{1,2})?)/i
  );

  if (!bankMatch) {
    return { error: "bank alert missing merchant, timestamp, or amount fields" };
  }

  const merchant = bankMatch[1]?.trim();
  const amount = Number.parseFloat(bankMatch[3] ?? "NaN");
  const timestamp = normalizeAlertTimestamp(bankMatch[2]);

  if (!merchant) {
    return { error: "bank alert merchant was empty" };
  }

  if (!Number.isFinite(amount)) {
    return { error: "bank alert amount was not a valid number" };
  }

  if (!timestamp) {
    return { error: "bank alert timestamp was not parseable" };
  }

  return { amount, merchant, timestamp };
}

function parseFastagAlert(payload: string): ExpenseAlertParseResult {
  const fastagMatch = payload.match(
    /FASTag(?:\s+Debit)?\s*:\s*(?:Toll Plaza\s+)?(.+?)\s+charged\s+(?:INR|RS\.?|Rs\.?)\s*([0-9]+(?:\.[0-9]{1,2})?)\s+(?:at|on)\s+([0-9A-Za-z:\-\sTZ]+)/i
  );

  if (!fastagMatch) {
    return { error: "FASTag alert missing toll plaza, timestamp, or amount fields" };
  }

  const merchant = fastagMatch[1]?.trim();
  const amount = Number.parseFloat(fastagMatch[2] ?? "NaN");
  const timestamp = normalizeAlertTimestamp(fastagMatch[3]);

  if (!merchant) {
    return { error: "FASTag alert merchant was empty" };
  }

  if (!Number.isFinite(amount)) {
    return { error: "FASTag alert amount was not a valid number" };
  }

  if (!timestamp) {
    return { error: "FASTag alert timestamp was not parseable" };
  }

  return {
    amount,
    merchant: `Toll Plaza ${merchant}`,
    timestamp
  };
}

export function parseImportedExpensePayload(payload: string): ExpenseAlertParseResult {
  const trimmedPayload = payload.trim();

  if (!trimmedPayload) {
    return { error: "payload was empty" };
  }

  if (/FASTag/i.test(trimmedPayload)) {
    return parseFastagAlert(trimmedPayload);
  }

  return parseBankAlert(trimmedPayload);
}
