export type TagCondition = {
  kind: "tagged" | "not-tagged";
  tag: string;
};

export function splitTags(value?: string | null) {
  return (value ?? "")
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function matchesTagConditions(
  tags: string | null | undefined,
  conditions: TagCondition[],
) {
  if (!conditions.length) return false;

  const normalizedTags = new Set(splitTags(tags).map((tag) => tag.toLocaleLowerCase()));

  return conditions.every((condition) => {
    const hasTag = normalizedTags.has(condition.tag.trim().toLocaleLowerCase());
    return condition.kind === "tagged" ? hasTag : !hasTag;
  });
}
