/**
 * Binds a save's idempotency key to the payload it was sent with.
 *
 * budgettracker's `createTransactionBatch` replays by key alone and ignores the
 * payload on a replay. So a key may only be reused for the exact entry it was
 * first sent with: retrying an unchanged entry after a lost response replays
 * safely, while an edited entry gets a fresh key and is written as itself.
 */
export interface SaveAttempt {
  key: string;
  /** The serialised payload this key was first sent with. */
  signature: string;
}

/** The attempt to send `signature` under: the pending one if it matches, else a fresh key. */
export const attemptFor = (
  pending: SaveAttempt | null,
  signature: string,
  freshKey: () => string,
): SaveAttempt =>
  pending !== null && pending.signature === signature ? pending : { key: freshKey(), signature };
