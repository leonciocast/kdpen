import { z } from "zod";
import { AiError } from "@/lib/ai/bedrock";
import { regenerateCase } from "@/lib/ai/generate";
import { AiOutline, GenerateRequest } from "@/lib/ai/schema";
import { aiConfigured, clientIp, llmFor, log, rateLimited } from "@/lib/ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const Body = z.object({ options: GenerateRequest, outline: AiOutline, index: z.number().int().min(1), avoid: z.object({ title: z.string().max(80).optional(), words: z.array(z.string().max(30)).max(20).optional() }).default({}) });

/** Write one case again (same outline and cast). */
export async function POST(request: Request) {
  if (!aiConfigured()) return Response.json({ error: "AI cases need AWS setup on the server.", code: "not-configured" }, { status: 503 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Some options are out of range." }, { status: 400 });
  const wait = rateLimited(clientIp(request.headers));
  if (wait) return Response.json({ error: `Too many requests. Try again in ${Math.ceil(wait / 60)} min.` }, { status: 429, headers: { "Retry-After": String(wait) } });
  const { options, outline, index, avoid } = parsed.data;
  if (index > outline.cases.length) return Response.json({ error: "No such case." }, { status: 400 });
  const t0 = Date.now();
  try {
    const out = await regenerateCase(options, outline, index, avoid, llmFor(options), AbortSignal.timeout(240000));
    log("case", `regenerate #${index}`, out.usage, Date.now() - t0);
    return Response.json({ spec: out.spec, notes: out.notes });
  } catch (e) {
    return Response.json({ error: e instanceof AiError ? e.message : "This case couldn't be rewritten right now." }, { status: 502 });
  }
}
