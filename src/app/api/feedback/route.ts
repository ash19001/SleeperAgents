import { saveFeedback } from "@/lib/source";
import { failure } from "@/lib/http";

const RATINGS = new Set(["helpful", "not_helpful"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const { question, bill_b, rating } = body ?? {};
  if (typeof question !== "string" || typeof bill_b !== "string" || !RATINGS.has(rating)) {
    return Response.json({ error: "Send question, bill_b and a rating of helpful or not_helpful." }, { status: 400 });
  }
  try {
    return Response.json(await saveFeedback({ question, bill_b, rating }));
  } catch (err) {
    return failure(err);
  }
}
