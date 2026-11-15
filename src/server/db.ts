import "server-only";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma client for the shared budgettracker database, connected as the
 * least-privilege `dense_app` role. Same global-cache pattern as budgettracker's
 * `src/lib/prisma.ts`, so dev hot reloads do not open a new pool each time.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
