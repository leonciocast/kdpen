import { GenerateRequest } from "@/lib/ai/schema";
import { aiConfigured, clientIp, rateLimited, startJob } from "@/lib/ai/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Start writing a book; poll GET /api/mystery/generate/{id} for progress and the result. */
export async function POST(request: Request) {
  if (!aiConfigured()) return Response.json({ error: "AI cases need AWS setup on the server.", code: "not-configured" }, { status: 503 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Send the options as JSON." }, { status: 400 });
  }
  const parsed = GenerateRequest.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Some options are out of range.", details: parsed.error.issues.slice(0, 5).map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
  const ip = clientIp(request.headers);
  const wait = rateLimited(ip);
  if (wait) return Response.json({ error: `Too many requests. Try again in ${Math.ceil(wait / 60)} min.` }, { status: 429, headers: { "Retry-After": String(wait) } });
  const job = startJob(parsed.data, ip);
  if (typeof job === "string") return Response.json({ error: job }, { status: 429 });
  return Response.json({ id: job.id }, { status: 202 });
}
