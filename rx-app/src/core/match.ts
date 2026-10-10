import { DRUGS, type Drug } from './drugs';

// Handwriting-aware edit distance: common letter confusions cost less than other substitutions.
const CONF = new Set([
  'a|o', 'o|a', 'e|c', 'c|e', 'i|l', 'l|i', '1|l', 'l|1', '1|i', 'i|1', 'n|u', 'u|n', 'm|n', 'n|m',
  'r|n', 'n|r', '0|o', 'o|0', '5|s', 's|5', 'h|b', 'b|h', 'g|q', 'q|g', 't|f', 'f|t', 'v|u', 'u|v', 'y|g', 'g|y',
]);

export function dist(a: string, b: string): number {
  a = a.toLowerCase();
  b = b.toLowerCase();
  const d: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const ca = a[i - 1], cb = b[j - 1];
      const sub = ca === cb ? 0 : CONF.has(ca + '|' + cb) ? 0.4 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + sub);
    }
  }
  return d[a.length][b.length];
}

export type Ranked = { drug: Drug; score: number; via: string };

// Instruction words are never drug names. Left in, "tab bid" scores 0.29 against the brand
// Tabloid (thioguanine) in a full drug list, so an unreadable name would come back as a real drug.
const SIG_WORDS = new Set([
  'tab', 'tabs', 'tablet', 'tablets', 'cap', 'caps', 'capsule', 'capsules', 'sachet', 'sachets', 'puff', 'puffs',
  'drop', 'drops', 'tsp', 'bid', 'tid', 'qid', 'qod', 'prn', 'daily', 'once', 'twice', 'times', 'day', 'days',
  'week', 'weeks', 'wks', 'hrs', 'hour', 'hours', 'every', 'mg', 'mcg', 'units', 'unit', 'with', 'food', 'after',
  'before', 'meal', 'meals', 'for', 'take', 'sig', 'and', 'the', 'needed', 'bedtime', 'mouth', 'orally', 'eating',
]);

/** Ranks every drug in the list against the text. Score is distance / name length (0 = exact). */
export function matchDrug(text: string, drugs: Drug[] = DRUGS): Ranked[] {
  const words = text.toLowerCase().replace(/[^a-z0-9\- ]/g, ' ').split(/\s+/)
    .filter((w) => w.length >= 3 && !SIG_WORDS.has(w) && !/\d/.test(w));
  const grams = [...words];
  for (let i = 0; i < words.length - 1; i++) grams.push(words[i] + ' ' + words[i + 1]);
  const scored: Ranked[] = drugs.map((drug) => {
    let score = Infinity, via = drug.n;
    for (const name of [drug.n, ...drug.b]) {
      for (const g of grams) {
        const s = dist(g, name) / Math.max(name.length, 1);
        if (s < score) { score = s; via = name; }
      }
    }
    return { drug, score, via };
  });
  return scored.sort((x, y) => x.score - y.score);
}

/** Tall Man style display: capitalises the letters where two names differ (hydrOXYzine / hydrALAZINE). */
export function tallMan(a: string, b: string): string {
  let i = 0;
  while (i < a.length && a[i] === b[i]) i++;
  let j = 0;
  while (j < a.length - i && j < b.length - i && a[a.length - 1 - j] === b[b.length - 1 - j]) j++;
  const up = (s: string) => s.slice(0, i) + s.slice(i, s.length - j).toUpperCase() + s.slice(s.length - j);
  return `${up(a)} / ${up(b)}`;
}
