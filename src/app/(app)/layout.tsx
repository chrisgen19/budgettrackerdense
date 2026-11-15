import { KeyboardProvider } from "@/components/shell/keyboard-provider";
import { Sidebar } from "@/components/shell/sidebar";
import { TopBar } from "@/components/shell/top-bar";
import { currentMonthKey } from "@bt/lib/credit-account-queries";
import { requireCurrentUser } from "@/server/session";

/**
 * The app shell (`.d-shell`): a 196px sticky sidebar beside a sticky command
 * bar on the desktop layout, and on a phone the command bar with a scrolling
 * tab row underneath. Every page inside it is already behind the session gate,
 * and `requireCurrentUser()` here is the second of the two checks plan 04
 * describes.
 */
export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireCurrentUser();

  return (
    <KeyboardProvider>
      <div className="grid min-h-full grid-rows-[auto_1fr] desk:grid-cols-[196px_1fr]">
        <Sidebar monthLabel={currentMonthKey(user.timezoneOffset)} />
        <TopBar />
        <main className="min-w-0 p-3 desk:px-4 desk:py-3.5">{children}</main>
      </div>
    </KeyboardProvider>
  );
}
