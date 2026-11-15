import { cancelJob, getJob } from "@/lib/ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const job = getJob((await ctx.params).id);
  if (!job) return Response.json({ error: "This job has expired. Please generate again." }, { status: 404 });
  const { status, progress, error, result } = job;
  return Response.json(
    { status, progress, error, result: result ? { book: result.book, outline: result.outline, caseNotes: result.caseNotes, indexes: result.indexes, notes: result.notes } : undefined },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  return Response.json({ cancelled: cancelJob((await ctx.params).id) });
}
