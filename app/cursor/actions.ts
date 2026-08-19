"use server";

import {
  createSavedView,
  deleteSavedView,
  setDefaultSavedView,
  updateSavedView,
} from "@/lib/db";
import { parseViewConfig, type BoardViewConfig } from "@/lib/saved-views";
import { revalidatePath } from "next/cache";

function refreshBoard() {
  revalidatePath("/cursor");
}

export async function createViewAction(input: {
  name: string;
  config: BoardViewConfig;
  makeDefault: boolean;
}) {
  const result = createSavedView(input.name, parseViewConfig(input.config), input.makeDefault);
  if (result.ok) refreshBoard();
  return result;
}

export async function updateViewAction(input: {
  id: string;
  name: string;
  config: BoardViewConfig;
}) {
  const result = updateSavedView(input.id, input.name, parseViewConfig(input.config));
  if (result.ok) refreshBoard();
  return result;
}

export async function setDefaultViewAction(id: string | null) {
  const result = setDefaultSavedView(id);
  if (result.ok) refreshBoard();
  return result;
}

export async function deleteViewAction(id: string) {
  const result = deleteSavedView(id);
  if (result.ok) refreshBoard();
  return result;
}
