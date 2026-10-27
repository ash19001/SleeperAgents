import { ask } from "@/lib/source";
import { failure, readText, userMessage } from "@/lib/http";
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
  // If the page goes away mid-answer, the agents still finish (and the answer
  // is still recorded); there's just no one left to send steps to.
  let open = true;
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
        } catch {
          open = false;
        }
      };
      const step = ({ step, agent, label, route, model, receipt, ms }: TraceStep) => send({ type: "step", step: { step, agent, label, route, model, receipt, ms } });
      try {
        send({ type: "result", result: await ask(question.value, step) });
      } catch (err) {
        send({ type: "error", message: userMessage(err) });
      }
      if (open) controller.close();
    },
    cancel() {
      open = false;
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-cache, no-transform" } });
}
