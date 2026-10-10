import { matchDrug } from './match';
import type { Drug } from './drugs';

export type Reading = { text: string; altPicked: boolean };

/**
 * Chooses among a reader's ranked guesses for one line. The first guess stands unless a lower-ranked
 * guess names a listed medicine much more closely (Vision often has "Amlodipine" in its top 10 when its
 * first guess is "Amloid pine"). A switch is reported, so the field can never look more certain than
 * the reader was: the user still compares the result with the ink.
 */
export function pickReading(variants: string[], drugs: Drug[]): Reading {
  const vs = variants.map((v) => v.replace(/\s+/g, ' ').trim()).filter(Boolean);
  if (!vs.length) return { text: '', altPicked: false };
  const score = (v: string) => matchDrug(v, drugs)[0]?.score ?? Infinity;
  const first = score(vs[0]);
  let best = 0, bestScore = first;
  for (let i = 1; i < vs.length; i++) {
    const s = score(vs[i]);
    if (s < bestScore - 1e-9) { best = i; bestScore = s; }
  }
  if (best !== 0 && !(bestScore <= 0.15 && first - bestScore >= 0.1)) best = 0;
  return { text: vs[best], altPicked: best !== 0 };
}

/** The names Vision should expect: every generic and brand, written as they appear on paper. */
export function customWords(drugs: Drug[], max = 4000): string[] {
  const cap = (s: string) => s.replace(/\b[a-z]/g, (ch) => ch.toUpperCase());
  const out = new Set<string>();
  for (const d of drugs) {
    for (const n of [d.n, ...d.b]) for (const w of n.split(/\s*\/\s*/)) if (w.length >= 4) out.add(cap(w));
    if (out.size >= max) break;
  }
  return [...out].slice(0, max);
}

const SIG = /\b(\d+(\.\d+)?\s*(mg|mcg|g|ml|iu|units?)|tabs?|tablets?|caps?|capsules?|sachets?|od|bid|tid|qid|qd|hs|prn|q\s?\d+\s?h|once|twice|daily|x\s*\d+\s*(d|days?|wks?|weeks?))\b|#\s*\d+/i;
const NOT_MEDICINE = /\b(pt|patient|name|age|sex|address|dr|md|doctor|clinic|hospital|ptr|lic|s2|prc|signature|date)\b|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/i;

/** Whether a found line looks like part of a medicine order (a drug name, a strength, or instructions). */
export function looksLikeMedicineLine(text: string, drugs: Drug[]): boolean {
  const t = text.trim();
  if (t.length < 2 || NOT_MEDICINE.test(t)) return false;
  if (SIG.test(t)) return true;
  const top = matchDrug(t, drugs)[0];
  return !!top && top.score <= 0.25;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9#]+/g, ' ').trim();
const numbers = (s: string) => (s.match(/\d+(\.\d+)?/g) ?? []).join(',');

/**
 * Whether two independent readings of one line disagree on anything that matters: the medicine they name,
 * or any number (strength, amount, days, quantity). Small differences in spacing or case do not count.
 */
export function readersDisagree(a: string, b: string, drugs: Drug[]): boolean {
  if (!a.trim() || !b.trim()) return false;
  if (norm(a) === norm(b)) return false;
  if (numbers(a) !== numbers(b)) return true;
  const da = matchDrug(a, drugs)[0], db = matchDrug(b, drugs)[0];
  const named = (r: typeof da) => (r && r.score <= 0.34 ? r.drug.n : '');
  return named(da) !== named(db);
}
