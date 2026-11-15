import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { APP_NAME, pageTitle } from "@/lib/app";
import { getCurrentUser } from "@/server/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: pageTitle("Sign in"),
};

/** The only page `src/proxy.ts` lets through without a session. */
export default async function LoginPage() {
  if (await getCurrentUser()) redirect("/overview");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <h1 className="text-lg font-semibold tracking-tight">{APP_NAME}</h1>
      <LoginForm />
    </main>
  );
}
