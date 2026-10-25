import { BillError, BillInput } from "@/data/added";
import { failure } from "@/lib/http";
import { addBill, billDraft } from "@/lib/source";

const UTILITIES = new Set(["electricity", "gas", "water"]);

// GET ?utility=gas: what the add-a-bill form starts with (the period after
// the latest bill, and its closing reading).
export async function GET(request: Request) {
  const utility = new URL(request.url).searchParams.get("utility") ?? "";
  if (!UTILITIES.has(utility)) return Response.json({ error: "Send utility as electricity, gas or water." }, { status: 400 });
  try {
    return Response.json({ draft: billDraft(utility as "electricity" | "gas" | "water") });
  } catch (err) {
    return failure(err);
  }
}

// POST a bill's figures: checked, saved into the supplier feed, and Zetaris refreshed.
export async function POST(request: Request) {
  const parsed = BillInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: parsed.error.issues.map((i) => `${i.path.join(".") || "bill"}: ${i.message}`).join("; ") }, { status: 400 });
  try {
    return Response.json(await addBill(parsed.data));
  } catch (err) {
    if (err instanceof BillError) return Response.json({ error: err.message, problems: err.problems }, { status: 400 });
    return failure(err);
  }
}
