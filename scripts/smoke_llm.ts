// Phase 2 smoke test: list Nightshift models, then send one chat through
// Nightshift and one direct to NVIDIA. Prints status, model and reply text.
// Never prints tokens or keys.

process.loadEnvFile(".env.local");
const env = process.env;

const PROMPT = "Reply with one short sentence saying which model you are.";
const CHAT_TIMEOUT_MS = 180_000;

async function listNightshiftModels(): Promise<boolean> {
  const label = "Nightshift /models";
  try {
    const res = await fetch(`${env.NIGHTSHIFT_BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${env.NIGHTSHIFT_TOKEN}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status === 401 || res.status === 403) {
      console.log(`[FAIL] ${label}: HTTP ${res.status}, wrong token`);
      return false;
    }
    if (!res.ok) {
      console.log(`[FAIL] ${label}: HTTP ${res.status}`);
      return false;
    }
    const body = await res.json();
    const ids: string[] = (body.data ?? []).map((m: { id: string }) => m.id);
    const online = ids.some((id) => id.startsWith("meterless/"));
    console.log(`[${online ? "PASS" : "FAIL"}] ${label}: ${ids.join(", ") || "(none)"}`);
    return online;
  } catch (err) {
    console.log(`[FAIL] ${label}: no answer, offline (${(err as Error).message})`);
    return false;
  }
}

async function chat(
  label: string,
  baseUrl: string,
  key: string,
  model: string,
  extraHeaders: Record<string, string> = {},
): Promise<boolean> {
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...extraHeaders,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: PROMPT }],
        max_tokens: 1024,
      }),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });
    const ms = Date.now() - started;
    if (!res.ok) {
      console.log(`[FAIL] ${label}: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`);
      return false;
    }
    const body = await res.json();
    const text: string = body.choices?.[0]?.message?.content?.trim() ?? "";
    // Nightshift adds a compute receipt naming the model that actually answered.
    const routed: string = body.meterless?.routed_model ?? body.model;
    const nemotron = /nemotron/i.test(routed);
    const ok = Boolean(text) && nemotron;
    console.log(`[${ok ? "PASS" : "FAIL"}] ${label}: asked for ${model}, answered by ${routed} in ${ms} ms`);
    if (!nemotron) console.log(`       not a Nemotron model`);
    if (body.meterless?.receipt_id) console.log(`       receipt ${body.meterless.receipt_id}`);
    console.log(`       ${text || "(no text returned)"}`);
    return ok;
  } catch (err) {
    console.log(`[FAIL] ${label}: ${(err as Error).message}`);
    return false;
  }
}

const results = [
  await listNightshiftModels(),
  await chat("Nightshift chat", env.NIGHTSHIFT_BASE_URL!, env.NIGHTSHIFT_TOKEN!, env.MODEL_FAST!, {
    "meterless-app": env.NIGHTSHIFT_APP_ID!,
    "meterless-scope": "user",
  }),
  await chat("NVIDIA direct chat", env.NVIDIA_BASE_URL!, env.NVIDIA_API_KEY!, env.NVIDIA_MODEL_FAST!),
];

process.exitCode = results.every(Boolean) ? 0 : 1;
