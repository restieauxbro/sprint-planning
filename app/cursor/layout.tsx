import { connection } from "next/server";
import { loadIntent } from "@/lib/db";
import { CursorSidebar } from "./_components/sidebar";

export const dynamic = "force-dynamic";

export default async function CursorLayout({ children }: LayoutProps<"/cursor">) {
  await connection();
  const loaded = loadIntent();
  const peopleCount = loaded.ok ? loaded.intent.engineers.length : null;

  return (
    <div className="flex h-dvh bg-[#f4f0e6] text-stone-900">
      <CursorSidebar peopleCount={peopleCount} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
