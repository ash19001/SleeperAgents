import { getMode } from "@/lib/mode";

export function GET() {
  return Response.json({ mode: getMode() });
}
