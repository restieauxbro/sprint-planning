import type { Engineer } from "@/lib/schema";
import { peopleInViewSection, type ViewSection } from "@/lib/saved-views";
import { describe, expect, it } from "vitest";

const people: Engineer[] = [
  { id: "eng_one", name: "One", title: "Engineer", fte: 1, tags: "AI Team, Platform", sortOrder: 1 },
  { id: "eng_two", name: "Two", title: "Engineer", fte: 1, tags: "AI Team", sortOrder: 2 },
  { id: "eng_three", name: "Three", title: "BA", fte: 1, tags: "Applications", sortOrder: 3 },
];

const sections: ViewSection[] = [
  { id: "ai", name: "AI", filter: { kind: "tag", value: "ai team" } },
  { id: "platform", name: "Platform", filter: { kind: "tag", value: "Platform" } },
  { id: "other", name: "Everyone else", filter: { kind: "remainder" } },
];

describe("saved view sections", () => {
  it("allows a person to appear in every matching section", () => {
    expect(peopleInViewSection(sections[0]!, sections, people).map((person) => person.id)).toEqual(["eng_one", "eng_two"]);
    expect(peopleInViewSection(sections[1]!, sections, people).map((person) => person.id)).toEqual(["eng_one"]);
  });

  it("puts only people not claimed by another section in the remainder", () => {
    expect(peopleInViewSection(sections[2]!, sections, people).map((person) => person.id)).toEqual(["eng_three"]);
  });
});
