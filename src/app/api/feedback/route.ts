import { saveFeedback } from "@/lib/source";
import { failure } from "@/lib/http";

const RATINGS = new Set(["helpful", "not_helpful"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { question, bill_a, bill_b, rating, memory } = body ?? {};
  if (typeof question !== "string" || typeof bill_b !== "string" || !RATINGS.has(rating)) {
    return Response.json({ error: "Send question, bill_b and a rating of helpful or not_helpful." }, { status: 400 });
  }
  const notes = Array.isArray(memory) ? memory.filter((m): m is string => typeof m === "string").slice(0, 20) : [];
  try {
    return Response.json(await saveFeedback({ question, bill_a: typeof bill_a === "string" ? bill_a : undefined, bill_b, rating, memory: notes }));
  } catch (err) {
    return failure(err);
  }
}
