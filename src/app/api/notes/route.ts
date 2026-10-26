import { getMemoryAudit, getNotes } from "@/lib/source";
import { failure } from "@/lib/http";

// The household notes, and the memory's audit (live mode).
export async function GET() {
  try {
    const [notes, audit] = await Promise.all([getNotes(), getMemoryAudit()]);
    return Response.json({ notes, audit });
  } catch (err) {
    return failure(err);
  }
}
