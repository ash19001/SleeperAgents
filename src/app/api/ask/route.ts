import { ask } from "@/lib/source";
import { failure, readText } from "@/lib/http";

export async function POST(request: Request) {
  const question = await readText(request, "question");
  if (!question.ok) return question.response;
  try {
    return Response.json(await ask(question.value));
  } catch (err) {
    return failure(err);
  }
}
