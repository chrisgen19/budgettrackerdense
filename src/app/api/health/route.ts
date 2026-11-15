import type { NextRequest } from "next/server";
import { prisma } from "@/server/db";

/**
 * Coolify's health check (docs/plans/08-deploy-coolify.md).
 *
 * Plain `GET` proves the server answers and never touches the database, so a
 * database outage does not make Coolify restart a healthy app. `?db=1` also
 * runs `SELECT 1` as `dense_app`, for checking the connection by hand. Either
 * way the body is only `{ ok }`: this route is outside the login gate
 * (`src/proxy.ts`), so a failure must not say why.
 */
export async function GET(request: NextRequest): Promise<Response> {
  if (request.nextUrl.searchParams.get("db") !== "1") return health(true);

  try {
    await prisma.$queryRaw`SELECT 1`;
    return health(true);
  } catch {
    return health(false);
  }
}

const health = (ok: boolean): Response =>
  Response.json({ ok }, { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
