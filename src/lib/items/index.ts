import aliases from "./aliases.json";
import { buildIndex } from "./match.mjs";

export { hintLines, resolveNote } from "./match.mjs";

/** The team's real items plus the alias data, ready for the matcher. */
export function buildTeamIndex(items: { id: string; title: string; category: string }[]) {
  return buildIndex(items, aliases);
}
