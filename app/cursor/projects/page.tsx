import { connection } from "next/server";
import { loadIntent } from "@/lib/db";
import { ProjectsRoster } from "./_components/projects-roster";

export const dynamic = "force-dynamic";

export default async function ProjectsPage() {
  await connection();
  const loaded = loadIntent();

  if (!loaded.ok) {
    return <div className="flex h-full items-center justify-center px-6 text-stone-600">Cannot load projects: {loaded.message}</div>;
  }

  return <ProjectsRoster projects={loaded.intent.projects} />;
}
