import { APP_NAME } from "@/lib/app";

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{APP_NAME}</h1>
      <p className="text-sm opacity-60">Scaffold only. No data yet.</p>
    </main>
  );
}
