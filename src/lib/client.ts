// The browser couldn't reach the app's own server at all.
const SERVER_DOWN = "The app's server isn't answering. Check that it's running, then try again.";

async function call(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch {
    throw new Error(SERVER_DOWN);
  }
}

// Browser-side call to one of the app's API routes.
export async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await call(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `${url} answered ${res.status}`);
  return data as T;
}

// Posts and reads an NDJSON stream, handing each event to onEvent as it arrives.
export async function postStream(url: string, body: unknown, onEvent: (event: Record<string, unknown>) => void): Promise<void> {
  const res = await call(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/x-ndjson" },
    body: JSON.stringify(body),
  });
  if (!res.ok || !res.body) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `${url} answered ${res.status}`);
  }
  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read().catch(() => {
      throw new Error(SERVER_DOWN); // the server stopped partway through
    });
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) if (line.trim()) onEvent(JSON.parse(line));
  }
  if (buffer.trim()) onEvent(JSON.parse(buffer));
}
