import { feedRecords, FEEDS } from "@/data/feeds";

// The SAMPLE household's supplier feeds as read-only JSON, each wrapped as
// {"records": [...]}, for Zetaris to register as REST tables (it reaches
// this app at host.docker.internal:5175). Octopus and Open-Meteo are
// registered from their own public APIs instead.
export async function GET(_req: Request, ctx: { params: Promise<{ source: string }> }) {
  const { source } = await ctx.params;
  if (!(source in FEEDS)) return Response.json({ error: `No feed called ${source}. Feeds: ${Object.keys(FEEDS).join(", ")}.` }, { status: 404 });
  return Response.json({ source, note: "SAMPLE data: a made-up household.", records: feedRecords(source as keyof typeof FEEDS) });
}
