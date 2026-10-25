// Small helpers for the API routes.

const MAX_TEXT = 500;

export function failure(err: unknown) {
  return Response.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
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
