import { getBills } from "@/lib/source";
import { failure } from "@/lib/http";

export async function GET() {
  try {
    return Response.json({ bills: await getBills() });
  } catch (err) {
    return failure(err);
  }
}
