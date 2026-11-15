/**
 * Read smoke test, run by hand against a local database:
 *
 *   pnpm smoke:reads            # the only user, or $SMOKE_USER_EMAIL
 *
 * Proves the vendored queries run unchanged in this app: same Prisma client,
 * same rules, and the user's own `timezone_offset` passed explicitly to every
 * call. Read-only, and it names the offset it used so a wrong month is visible
 * rather than plausible.
 */
import { getMonthlySummary } from "@bt/lib/budget-queries";
import { getCreditAccountSummaries, readTimezoneOffset } from "@bt/lib/credit-account-queries";
import { prisma } from "../src/server/db";
import { fetchCategoryByMonth } from "../src/server/queries/category-by-month";
import { fetchDailySpend } from "../src/server/queries/daily-spend";
import { fetchLedger } from "../src/server/queries/ledger";

const peso = (amount: number): string =>
  `₱${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const line = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

/** The user to report on: `$SMOKE_USER_EMAIL`, or the only one in the database. */
async function resolveUser(): Promise<{ id: string; email: string }> {
  const email = process.env.SMOKE_USER_EMAIL;
  if (email) {
    const user = await prisma.user.findUnique({ where: { email }, select: { id: true, email: true } });
    if (!user) throw new Error(`No user with email ${email}.`);
    return user;
  }

  const users = await prisma.user.findMany({ select: { id: true, email: true }, take: 2 });
  const [only] = users;
  if (!only) throw new Error("No users in this database. Is DATABASE_URL pointing at the mirror?");
  if (users.length > 1) throw new Error("More than one user: set SMOKE_USER_EMAIL.");
  return only;
}

async function main(): Promise<void> {
  const user = await resolveUser();
  const tz = await readTimezoneOffset(prisma, user.id);

  line(`User ${user.email} (${user.id})`);
  line(`timezone_offset ${tz} minutes (UTC${tz <= 0 ? "+" : "-"}${Math.abs(tz) / 60})\n`);

  line("getMonthlySummary, last 6 months");
  const months = await getMonthlySummary(prisma, user.id, { months: 6, timezoneOffset: tz });
  for (const month of months) {
    const coverage = month.isPartial ? ` partial ${month.daysElapsed}/${month.daysInMonth}d` : "";
    line(
      `  ${month.monthKey}  in ${peso(month.income).padStart(14)}  out ${peso(month.expenses).padStart(14)}  net ${peso(month.net).padStart(14)}${coverage}`,
    );
  }

  line("\ngetCreditAccountSummaries");
  const cards = await getCreditAccountSummaries(prisma, user.id);
  if (cards.length === 0) line("  no cards");
  for (const card of cards) {
    const limit = card.creditLimit === null ? "no limit" : peso(card.creditLimit);
    const utilization = card.utilization === null ? "n/a" : `${card.utilization}%`;
    line(`  ${card.name}  owed ${peso(card.balance)}  of ${limit}  utilization ${utilization}`);
  }

  // The newest month with anything logged, so the dense section shows rows
  // rather than an empty current month on a stale local mirror.
  const latest = months.filter((month) => month.income > 0 || month.expenses > 0).at(-1)?.monthKey;
  if (!latest) {
    line("\nNo month in range has any transactions: refresh the local mirror.");
    return;
  }

  line(`\nDense queries for ${latest}`);
  const ledger = await fetchLedger(prisma, user.id, { timezoneOffset: tz, month: latest, limit: 5 });
  line(
    `  ledger: ${ledger.totals.count} rows, out ${peso(ledger.totals.expenses)}, ${ledger.days.length} day group(s) on page 1`,
  );
  for (const row of ledger.rows) {
    line(`    ${row.localDate}  ${peso(row.amount).padStart(14)}  ${row.description}`);
  }

  const burn = await fetchDailySpend(prisma, user.id, { timezoneOffset: tz, month: latest });
  line(`  daily spend: ${burn.days.length} days, total ${peso(burn.total)}`);

  const matrix = await fetchCategoryByMonth(prisma, user.id, {
    timezoneOffset: tz,
    endMonth: latest,
    months: 3,
  });
  line(`  category x month: ${matrix.rows.length} categories over ${matrix.months.join(", ")}`);
  for (const row of matrix.rows.slice(0, 5)) {
    line(`    ${row.name.padEnd(20)} ${row.amounts.map((a) => peso(a).padStart(14)).join(" ")}`);
  }
}

main()
  .catch((error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
