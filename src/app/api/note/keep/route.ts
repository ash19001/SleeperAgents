import { keepNote } from "@/lib/source";
import { failure, readText } from "@/lib/http";

// The household keeps a note that was flagged for review, so answers use it again.
export async function POST(request: Request) {
  const id = await readText(request, "id");
  if (!id.ok) return id.response;
  try {
    return Response.json({ note: await keepNote(id.value) });
  } catch (err) {
    return failure(err);
  }
}
