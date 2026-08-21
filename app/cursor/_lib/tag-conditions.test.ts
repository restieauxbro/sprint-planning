import { describe, expect, it } from "vitest";
import { matchesTagConditions, splitTags } from "@/lib/tag-conditions";

describe("tag conditions", () => {
  it("splits comma-separated tags and removes empty values", () => {
    expect(splitTags(" AI Team, Platform,  ")).toEqual(["AI Team", "Platform"]);
  });

  it("matches tags without regard to case or surrounding whitespace", () => {
    expect(
      matchesTagConditions("AI Team, Platform", [{ kind: "tagged", tag: " ai team " }]),
    ).toBe(true);
  });

  it("supports exclusions", () => {
    expect(
      matchesTagConditions("AI Team", [{ kind: "not-tagged", tag: "Applications" }]),
    ).toBe(true);
    expect(
      matchesTagConditions("AI Team, Applications", [
        { kind: "not-tagged", tag: "Applications" },
      ]),
    ).toBe(false);
  });

  it("requires every condition to match", () => {
    const conditions = [
      { kind: "tagged", tag: "AI Team" },
      { kind: "not-tagged", tag: "Platform" },
    ] as const;

    expect(matchesTagConditions("AI Team", [...conditions])).toBe(true);
    expect(matchesTagConditions("AI Team, Platform", [...conditions])).toBe(false);
    expect(matchesTagConditions("Applications", [...conditions])).toBe(false);
  });

  it("does not match without a condition", () => {
    expect(matchesTagConditions("AI Team", [])).toBe(false);
  });
});
