import { getCatalog } from "@/lib/github";

export const dynamic = "force-dynamic";

/** Public read-only feed; no credentials or private records returned. */
export async function GET() {
  const data=await getCatalog();
  return Response.json(data,{headers:{"Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
}
