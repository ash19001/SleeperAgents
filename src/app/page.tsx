import { BillDesk } from "@/components/BillDesk";
import { getMode } from "@/lib/mode";
import { ask, examples, getBills, getHousehold, getNotes, previewAnswerIds, suggestedNote } from "@/lib/source";
import type { Mode } from "@/lib/types";

// Notes and answers change while the server runs, so render on every request.
export const dynamic = "force-dynamic";

async function load(mode: Mode) {
  try {
    const [household, bills, notes] = await Promise.all([getHousehold(), getBills(), getNotes()]);
    // Open with a worked example, except in live mode where each answer costs model calls.
    const initialResult = mode === "live" ? null : await ask(examples[0]);
    return { ok: true as const, household, bills, notes, initialResult };
  } catch (err) {
    return { ok: false as const, message: err instanceof Error ? err.message : String(err) };
  }
}

export default async function Home() {
  const mode = getMode();
  const data = await load(mode);
  if (!data.ok) {
    return (
      <main className="gutter mx-auto max-w-xl py-16">
        <h1 className="text-2xl font-extrabold">The bills couldn&apos;t load</h1>
        <p className="mt-3 text-ink-2">{data.message}</p>
      </main>
    );
  }
  return (
    <BillDesk
      mode={mode}
      household={data.household}
      bills={data.bills}
      initialNotes={data.notes}
      initialResult={data.initialResult}
      examples={examples}
      suggestedNote={suggestedNote}
      previewIds={previewAnswerIds()}
    />
  );
}
