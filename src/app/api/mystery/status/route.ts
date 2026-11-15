import { aiConfigured, isMock, modelId } from "@/lib/ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Whether AI cases can run here (no secrets in the answer). */
export function GET() {
  return Response.json({ configured: aiConfigured(), mock: isMock(), model: modelId() }, { headers: { "Cache-Control": "no-store" } });
}
