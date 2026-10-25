import { getHousehold } from "@/lib/source";
import { failure } from "@/lib/http";

export async function GET() {
  try {
    return Response.json({ household: await getHousehold() });
  } catch (err) {
    return failure(err);
  }
}
