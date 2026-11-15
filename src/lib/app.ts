/** Product name shown in the shell and in page titles. */
export const APP_NAME = "Dense";

/** Short description used for metadata. */
export const APP_DESCRIPTION = "Dense review view over the budget tracker database";

/**
 * Builds a browser tab title: the page name followed by the app name,
 * or just the app name when no page name is given.
 */
export function pageTitle(page?: string): string {
  return page ? `${page} - ${APP_NAME}` : APP_NAME;
}
