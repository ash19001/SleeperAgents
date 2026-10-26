// Small helpers for the API routes.

const MAX_TEXT = 500;

// A server error in words the household can act on; the full error goes to the log.
export function userMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[why-my-bill] ${err instanceof Error && err.stack ? err.stack : message}`);
  // Only when WHYBILL_DATA=zetaris; otherwise the local copy stands in.
  if (/^Zetaris\b/.test(message)) return `${message}. Start Zetaris, or unset WHYBILL_DATA so the app can read the local SAMPLE copy.`;
  return message;
}

export function failure(err: unknown) {
  return Response.json({ error: userMessage(err) }, { status: 500 });
}

// Reads one required text field from a JSON body.
export async function readText(request: Request, field: string):
  Promise<{ ok: true; value: string } | { ok: false; response: Response }> {
  const body = await request.json().catch(() => null);
  const value = typeof body?.[field] === "string" ? body[field].trim() : "";
  if (!value) return { ok: false, response: Response.json({ error: `Send ${field} as text.` }, { status: 400 }) };
  if (value.length > MAX_TEXT) {
    return { ok: false, response: Response.json({ error: `Keep ${field} under ${MAX_TEXT} characters.` }, { status: 400 }) };
  }
  return { ok: true, value };
}
