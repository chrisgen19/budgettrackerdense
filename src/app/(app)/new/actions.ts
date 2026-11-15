"use server";

import { z } from "zod";
import { requireCurrentUser } from "@/server/session";
import { createQuickEntry, type WriteResult } from "@/server/writes";

/**
 * The New entry form's one action. It narrows what the browser sent and hands
 * it to the write seam with the user's own timezone; it never touches Prisma.
 * `createQuickEntry` refuses with `DENSE_NOT_DEPLOYED` until step 0 ships, so a
 * hand-made request cannot write while the page shows Save disabled.
 */
const entrySchema = z.object({
  type: z.enum(["EXPENSE", "INCOME"]),
  amount: z.number().positive(),
  categoryId: z.string().min(1).max(100),
  labelIds: z.array(z.string().min(1).max(100)).max(20).optional(),
  creditAccountId: z.string().min(1).max(100).nullable().optional(),
  description: z.string().max(255),
  // Shape only; `createQuickEntry` refuses a date that does not exist.
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/),
});

export async function saveEntry(entry: unknown, clientBatchId: string): Promise<WriteResult> {
  const user = await requireCurrentUser();
  const parsed = entrySchema.safeParse(entry);
  if (!parsed.success) return { ok: false, reason: "INVALID_INPUT", retryable: false };

  return createQuickEntry(user.id, { ...parsed.data, timezoneOffset: user.timezoneOffset }, clientBatchId);
}
