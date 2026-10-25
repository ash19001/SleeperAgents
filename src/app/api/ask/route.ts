import { ask } from "@/lib/source";
import { failure, readText } from "@/lib/http";
import type { TraceStep } from "@/lib/types";

// A client that accepts NDJSON gets each agent step as it happens, then the
// result: {"type":"step","step":…} lines, then {"type":"result","result":…}.
// Anyone else gets the result as one JSON object.
export async function POST(request: Request) {
  const question = await readText(request, "question");
  if (!question.ok) return question.response;
  if (!request.headers.get("accept")?.includes("application/x-ndjson")) {
    try {
      return Response.json(await ask(question.value));
    } catch (err) {
      return failure(err);
    }
  }
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      const step = ({ step, agent, label, route, model, receipt, ms }: TraceStep) => send({ type: "step", step: { step, agent, label, route, model, receipt, ms } });
      try {
        send({ type: "result", result: await ask(question.value, step) });
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      }
      controller.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache, no-transform" } });
}
