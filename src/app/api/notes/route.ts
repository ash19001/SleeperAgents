import { getNotes } from "@/lib/source";
import { failure } from "@/lib/http";

export async function GET() {
  try {
    return Response.json({ notes: await getNotes() });
  } catch (err) {
    return failure(err);
  }
}
