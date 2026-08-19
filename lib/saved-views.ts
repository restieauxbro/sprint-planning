import type { Engineer } from "./schema";

export type ViewSectionFilter =
  | { kind: "tag"; value: string }
  | { kind: "title"; value: string }
  | { kind: "person"; value: string }
  | { kind: "remainder" };

export type ViewSection = {
  id: string;
  name: string;
  filter: ViewSectionFilter;
};

export type BoardViewConfig = {
  lens: "team" | "projects";
  horizon: number;
  projectFilter: string[];
  engineerFilter: string[];
  highlightProjectId: string | null;
  showProjectName: boolean;
  sections: ViewSection[];
};

export type SavedView = {
  id: string;
  name: string;
  config: BoardViewConfig;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_VIEW_CONFIG: BoardViewConfig = {
  lens: "team",
  horizon: 8,
  projectFilter: [],
  engineerFilter: [],
  highlightProjectId: null,
  showProjectName: true,
  sections: [],
};

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

export function parseViewConfig(value: unknown): BoardViewConfig {
  const source = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawSections = Array.isArray(source.sections) ? source.sections : [];
  const sections = rawSections.flatMap((item): ViewSection[] => {
    if (!item || typeof item !== "object") return [];
    const section = item as Record<string, unknown>;
    const filter = section.filter && typeof section.filter === "object"
      ? section.filter as Record<string, unknown>
      : {};
    const kind = filter.kind;
    if (!new Set(["tag", "title", "person", "remainder"]).has(String(kind))) return [];
    const name = typeof section.name === "string" ? section.name.trim() : "";
    if (!name) return [];
    if (kind !== "remainder" && typeof filter.value !== "string") return [];
    return [{
      id: typeof section.id === "string" && section.id ? section.id : crypto.randomUUID(),
      name,
      filter: kind === "remainder"
        ? { kind: "remainder" }
        : { kind: kind as "tag" | "title" | "person", value: String(filter.value).trim() },
    }];
  });

  return {
    lens: source.lens === "projects" ? "projects" : "team",
    horizon: typeof source.horizon === "number" && [0, 6, 8, 12].includes(source.horizon)
      ? source.horizon
      : DEFAULT_VIEW_CONFIG.horizon,
    projectFilter: stringArray(source.projectFilter),
    engineerFilter: stringArray(source.engineerFilter),
    highlightProjectId: typeof source.highlightProjectId === "string" ? source.highlightProjectId : null,
    showProjectName: source.showProjectName !== false,
    sections,
  };
}

function splitTags(value?: string | null) {
  return (value ?? "").split(",").map((tag) => tag.trim().toLocaleLowerCase()).filter(Boolean);
}

export function personMatchesSection(person: Engineer, filter: ViewSectionFilter) {
  if (filter.kind === "remainder") return false;
  if (filter.kind === "person") return person.id === filter.value;
  if (filter.kind === "title") return person.title.trim().toLocaleLowerCase() === filter.value.trim().toLocaleLowerCase();
  return splitTags(person.tags).includes(filter.value.trim().toLocaleLowerCase());
}

export function peopleInViewSection(section: ViewSection, sections: ViewSection[], people: Engineer[]) {
  if (section.filter.kind !== "remainder") {
    return people.filter((person) => personMatchesSection(person, section.filter));
  }
  const claimedFilters = sections
    .filter((item) => item.filter.kind !== "remainder")
    .map((item) => item.filter);
  return people.filter((person) => !claimedFilters.some((filter) => personMatchesSection(person, filter)));
}
