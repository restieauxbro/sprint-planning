import Link from "next/link";

export default function Home() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#f4f0e6] text-stone-900">
      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-8 py-16">
        <p className="font-mono text-[11px] tracking-[0.2em] text-stone-500 uppercase">
          Local · SQLite · two boards
        </p>
        <h1 className="font-heading mt-3 text-5xl leading-[0.95] tracking-tight">
          Sprint planner
        </h1>
        <p className="mt-4 max-w-md text-stone-600">
          One database of intent. Two independent views. Write rows with an
          agent; the board computes who is busy and when work ends.
        </p>
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Link
            href="/cursor"
            className="group border border-stone-800 bg-stone-900 px-5 py-6 text-[#f4f0e6] transition-colors hover:bg-stone-800"
          >
            <p className="font-mono text-[10px] tracking-wide uppercase opacity-70">
              This agent
            </p>
            <p className="font-heading mt-2 text-3xl">Cursor</p>
            <p className="mt-2 text-sm text-stone-300">
              Team and project timelines, alerts, inspector.
            </p>
          </Link>
          <Link
            href="/codex"
            className="border border-stone-400 bg-[#efeae0] px-5 py-6 transition-colors hover:border-stone-800"
          >
            <p className="font-mono text-[10px] tracking-wide text-stone-500 uppercase">
              Other agent
            </p>
            <p className="font-heading mt-2 text-3xl">Codex</p>
            <p className="mt-2 text-sm text-stone-600">
              Same SQLite file. Build lives at /codex once that agent lands.
            </p>
          </Link>
        </div>
      </main>
    </div>
  );
}
