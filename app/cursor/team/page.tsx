import { connection } from "next/server";
import { loadIntent } from "@/lib/db";
import { TeamRoster } from "./_components/roster";

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  await connection();
  const loaded = loadIntent();

  if (!loaded.ok) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-stone-800">
        <p className="font-mono text-[11px] tracking-wide text-amber-800 uppercase">
          {loaded.error === "missing" ? "Database missing" : "Schema stale"}
        </p>
        <h1 className="font-heading mt-2 text-3xl">Cannot load the team</h1>
        <p className="mt-3 max-w-md text-center text-stone-600">{loaded.message}</p>
        <p className="mt-4 font-mono text-sm">npm run db:init</p>
      </div>
    );
  }

  return <TeamRoster people={loaded.intent.engineers} />;
}
