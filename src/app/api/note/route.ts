import { addNote } from "@/lib/source";
import { failure, readText } from "@/lib/http";

export async function POST(request: Request) {
  const text = await readText(request, "text");
  if (!text.ok) return text.response;
  try {
    return Response.json({ note: await addNote(text.value) });
  } catch (err) {
    return failure(err);
  }
}
