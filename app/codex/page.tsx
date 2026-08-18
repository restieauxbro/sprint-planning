import { connection } from "next/server";
import { loadIntent } from "@/lib/db";
import { CodexBoard } from "./_components/board";
import { schedule } from "./_lib/schedule";

export const dynamic = "force-dynamic";

export default async function CodexPage() {
  await connection();
  const loaded = loadIntent();

  if (!loaded.ok) {
    const title = loaded.error === "missing" ? "Database missing" : "Schema stale";
    return (
      <main className="flex min-h-dvh items-center justify-center bg-[#f4f0e6] px-6 text-stone-900">
        <section className="w-full max-w-xl border border-stone-300 bg-[#faf7ef] p-8 shadow-[8px_8px_0_#d9d1c1]">
          <p className="font-mono text-[10px] tracking-[0.2em] text-amber-700 uppercase">
            missing db · planner.sqlite
          </p>
          <h1 className="font-heading mt-3 text-4xl">{title}</h1>
          <p className="mt-3 text-sm leading-6 text-stone-600">{loaded.message}</p>
          <code className="mt-6 block w-fit bg-stone-900 px-3 py-2 font-mono text-xs text-[#f4f0e6]">
            npm run db:init
          </code>
        </section>
      </main>
    );
  }

  return (
    <CodexBoard
      intent={loaded.intent}
      result={schedule(loaded.intent)}
      initialClock={new Date().toISOString()}
    />
  );
}
