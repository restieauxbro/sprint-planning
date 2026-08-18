export const PROJECT_INKS = [
  { fill: "oklch(0.78 0.06 230)", ink: "oklch(0.28 0.04 230)", label: "teal" },
  { fill: "oklch(0.82 0.08 70)", ink: "oklch(0.32 0.06 70)", label: "brass" },
  { fill: "oklch(0.80 0.06 150)", ink: "oklch(0.30 0.05 150)", label: "olive" },
  { fill: "oklch(0.80 0.07 25)", ink: "oklch(0.33 0.06 25)", label: "rust" },
  { fill: "oklch(0.82 0.05 300)", ink: "oklch(0.30 0.05 300)", label: "plum" },
] as const;

export function projectInk(index: number) {
  return PROJECT_INKS[index % PROJECT_INKS.length]!;
}

export function projectCode(project: { code?: string | null; name: string }) {
  const code = project.code?.trim();
  if (code) return code;
  const letters = project.name.replace(/[^A-Za-z0-9]/g, "");
  return letters.slice(0, 3) || "PRJ";
}

export function phaseLabel(
  project: { code?: string | null; name: string },
  phase: { name: string },
) {
  return `${projectCode(project)} ${phase.name}`;
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
}

export function givenName(name: string) {
  return name.trim().split(/\s+/)[0] || name.trim();
}

export function plannerLabels(people: { id: string; name: string }[]) {
  const counts = new Map<string, number>();
  for (const person of people) {
    const first = givenName(person.name);
    counts.set(first, (counts.get(first) ?? 0) + 1);
  }

  const labels = new Map<string, string>();
  for (const person of people) {
    const parts = person.name.trim().split(/\s+/);
    const first = parts[0] || person.name.trim();
    const last = parts.length > 1 ? parts[parts.length - 1]! : "";
    const initial = last.slice(0, 1).toUpperCase();
    labels.set(person.id, (counts.get(first) ?? 0) > 1 && initial ? `${first} ${initial}` : first);
  }
  return labels;
}
