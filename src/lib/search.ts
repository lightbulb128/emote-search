import Fuse from "fuse.js";
import type { EmoteEntry } from "./types";

let fuse: Fuse<EmoteEntry> | null = null;
let allEmotes: EmoteEntry[] = [];

export function createSearchIndex(emotes: EmoteEntry[]) {
  allEmotes = emotes;
  fuse = new Fuse(emotes, {
    keys: [
      { name: "name", weight: 3 },
      { name: "action", weight: 2 },
      { name: "variant", weight: 1.5 },
      { name: "tags", weight: 2 },
      { name: "character", weight: 0.5 },
    ],
    threshold: 0.4,
    distance: 100,
    includeScore: true,
    minMatchCharLength: 1,
  });
  return fuse;
}

export function search(query: string): EmoteEntry[] {
  if (!fuse) return [];
  const q = query.trim();
  if (!q) return [];

  // Tokenize: split on spaces and commas, filter empty, lowercase
  const tokens = q
    .split(/[\s,]+/)
    .map((t) => t.toLowerCase())
    .filter((t) => t.length > 0);

  if (tokens.length === 0) return [];

  // Search for each token separately and merge results.
  // This ensures "alice angry" finds both alice-only and angry-only items.
  const scored = new Map<string, { item: EmoteEntry; bestScore: number }>();

  for (const token of tokens) {
    const tokenResults = fuse.search(token);
    for (const r of tokenResults) {
      const existing = scored.get(r.item.id);
      const score = r.score ?? 1;
      if (!existing || score < existing.bestScore) {
        scored.set(r.item.id, { item: r.item, bestScore: score });
      }
    }
  }

  // Sort merged results by best Fuse score
  const allResults = [...scored.values()]
    .sort((a, b) => a.bestScore - b.bestScore)
    .map((r) => r.item);

  // If only one token, no need to reorder
  if (tokens.length <= 1) return allResults;

  // Split: exact token matches (ALL tokens appear) vs fuzzy only
  const exactMatches: EmoteEntry[] = [];
  const fuzzyMatches: EmoteEntry[] = [];

  for (const emote of allResults) {
    const searchable = [
      emote.name,
      emote.action,
      emote.variant,
      ...emote.tags,
      emote.character,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    const allTokensMatch = tokens.every((token) => searchable.includes(token));

    if (allTokensMatch) {
      exactMatches.push(emote);
    } else {
      fuzzyMatches.push(emote);
    }
  }

  return [...exactMatches, ...fuzzyMatches];
}

export function getAllEmotes(): EmoteEntry[] {
  return allEmotes;
}
