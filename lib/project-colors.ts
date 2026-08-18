export const PROJECT_COLORS = [
  { id: "teal", label: "Teal", fill: "oklch(0.78 0.06 230)", ink: "oklch(0.28 0.04 230)", solid: "#245d65", pale: "#d8e7e4", border: "#18454b" },
  { id: "brass", label: "Brass", fill: "oklch(0.82 0.08 70)", ink: "oklch(0.32 0.06 70)", solid: "#a17420", pale: "#efe4c8", border: "#755415" },
  { id: "olive", label: "Olive", fill: "oklch(0.80 0.06 150)", ink: "oklch(0.30 0.05 150)", solid: "#55733d", pale: "#e1ead8", border: "#3f572d" },
  { id: "rust", label: "Rust", fill: "oklch(0.80 0.07 25)", ink: "oklch(0.33 0.06 25)", solid: "#a44a32", pale: "#f2ddd3", border: "#793724" },
  { id: "plum", label: "Plum", fill: "oklch(0.82 0.05 300)", ink: "oklch(0.30 0.05 300)", solid: "#6d5a91", pale: "#e7e0ef", border: "#4f416c" },
  { id: "blue", label: "Blue", fill: "#bdd5e7", ink: "#225271", solid: "#3d718f", pale: "#dce9f1", border: "#28556f" },
  { id: "rose", label: "Rose", fill: "#e9c4c7", ink: "#733c48", solid: "#9d5760", pale: "#f3dfe1", border: "#7b424b" },
  { id: "sand", label: "Sand", fill: "#dfcfb4", ink: "#68533a", solid: "#8a704f", pale: "#eee5d5", border: "#6c573c" },
  { id: "moss", label: "Moss", fill: "#c8d1a9", ink: "#4b5a33", solid: "#6b7c4b", pale: "#e0e6d0", border: "#506039" },
  { id: "green", label: "Green", fill: "#b8d4bf", ink: "#315b42", solid: "#4d7a5a", pale: "#dceade", border: "#3d654a" },
  { id: "slate", label: "Slate", fill: "#c6d0d5", ink: "#48585f", solid: "#65777d", pale: "#e0e6e8", border: "#4e5e64" },
  { id: "charcoal", label: "Charcoal", fill: "#d1cbc3", ink: "#514c46", solid: "#6b645c", pale: "#e6e2dd", border: "#544f49" },
] as const;

export type ProjectColorId = (typeof PROJECT_COLORS)[number]["id"];

type ProjectColor = {
  id: string;
  label: string;
  fill: string;
  ink: string;
  solid: string;
  pale: string;
  border: string;
};

function isHexColor(value: string) {
  return /^#[0-9a-f]{6}$/i.test(value);
}

function customProjectColor(value: string): ProjectColor {
  const red = Number.parseInt(value.slice(1, 3), 16);
  const green = Number.parseInt(value.slice(3, 5), 16);
  const blue = Number.parseInt(value.slice(5, 7), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  const ink = luminance > 0.55 ? "#1c1917" : "#fffdf8";

  return {
    id: value,
    label: value.toUpperCase(),
    solid: value,
    fill: `color-mix(in srgb, ${value} 45%, white)`,
    pale: `color-mix(in srgb, ${value} 18%, white)`,
    border: value,
    ink,
  };
}

export function projectColor(value?: string | number | null) {
  if (typeof value === "number") return PROJECT_COLORS[value % PROJECT_COLORS.length]!;
  if (typeof value === "string" && isHexColor(value)) return customProjectColor(value);
  if (value === "violet") return customProjectColor("#7c3aed");
  return PROJECT_COLORS.find((color) => color.id === value) ?? PROJECT_COLORS[0];
}
