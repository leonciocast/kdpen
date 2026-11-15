export const dynamic = "force-dynamic";

/** The id of the build this server is running (compare with NEXT_PUBLIC_BUILD_ID in the page). */
export function GET() {
  return Response.json({ build: process.env.NEXT_PUBLIC_BUILD_ID ?? "" }, { headers: { "Cache-Control": "no-store" } });
}
