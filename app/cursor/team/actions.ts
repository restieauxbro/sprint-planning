"use server";

import { addEngineer, renameEngineer } from "@/lib/db";
import { revalidatePath } from "next/cache";

export type AddTeammateState = { error: string | null; added: boolean };

function refreshTeam() {
  revalidatePath("/cursor", "layout");
}

export async function addTeammate(
  _prev: AddTeammateState,
  formData: FormData,
): Promise<AddTeammateState> {
  const name = String(formData.get("name") ?? "");
  const title = String(formData.get("title") ?? "");
  const fteRaw = String(formData.get("fte") ?? "1");
  const fte = Number(fteRaw);

  const result = addEngineer({ name, title, fte });
  if (!result.ok) return { error: result.error, added: false };

  refreshTeam();
  return { error: null, added: true };
}

export async function renameTeammate(id: string, name: string): Promise<{ error: string | null }> {
  const result = renameEngineer(id, name);
  if (!result.ok) return { error: result.error };
  refreshTeam();
  return { error: null };
}
