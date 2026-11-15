/**
 * Links back to budgettracker.
 *
 * This app is read-only apart from quick entry, so anything that changes a plan,
 * a card or a category sends the user to the main app. The base URL is an
 * environment variable because the two apps are deployed separately; the
 * default is budgettracker's own dev port.
 */
const DEFAULT_BASE = "http://127.0.0.1:3111";

/** budgettracker's base URL, without a trailing slash. */
export function budgetTrackerUrl(base = process.env.BUDGETTRACKER_URL): string {
  return (base?.trim() || DEFAULT_BASE).replace(/\/+$/, "");
}

/** Where a budget plan is created and edited: the Analytics page's plan editor. */
export function budgetEditorUrl(base?: string): string {
  return `${budgetTrackerUrl(base)}/analytics`;
}

/** One transaction's detail in the main app. */
export function transactionUrl(id: string, base?: string): string {
  return `${budgetTrackerUrl(base)}/transactions?id=${encodeURIComponent(id)}`;
}

/** The bills page, where bills are set up, paid, skipped and snoozed. */
export function billsUrl(base?: string): string {
  return `${budgetTrackerUrl(base)}/bills`;
}
