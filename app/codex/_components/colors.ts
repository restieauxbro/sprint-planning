export const projectInks = [
  { solid: "#245d65", pale: "#d8e7e4", border: "#18454b" },
  { solid: "#a44a32", pale: "#f2ddd3", border: "#793724" },
  { solid: "#6d5a91", pale: "#e7e0ef", border: "#4f416c" },
  { solid: "#55733d", pale: "#e1ead8", border: "#3f572d" },
  { solid: "#a17420", pale: "#efe4c8", border: "#755415" },
];

export function projectInk(index: number) {
  return projectInks[index % projectInks.length];
}
