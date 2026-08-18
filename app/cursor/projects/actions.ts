"use server";

import { addProject, updateProject } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type AddProjectState = { error: string | null; added: boolean };

function refreshProjects() {
  revalidatePath("/cursor", "layout");
}

export async function createProject(
  _prev: AddProjectState,
  formData: FormData,
): Promise<AddProjectState> {
  const result = addProject({
    name: String(formData.get("name") ?? ""),
    code: String(formData.get("code") ?? ""),
    color: String(formData.get("color") ?? "teal"),
    priority: Number(formData.get("priority")),
    tags: String(formData.get("tags") ?? ""),
  });
  if (!result.ok) return { error: result.error, added: false };
  refreshProjects();
  return { error: null, added: true };
}

export async function editProject(id: string, name: string, code: string, color: string, priority: number, tags: string) {
  const result = updateProject(id, { name, code, color, priority, tags });
  if (!result.ok) return { error: result.error };
  refreshProjects();
  return { error: null };
}
