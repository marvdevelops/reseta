// Strength comparison by quantity, not by text: "50 mcg" equals RxNorm's "0.05 mg", and
// "250 mg/5 mL" equals "50 mg/mL". A unit the parser does not know falls back to the text
// comparison, so nothing unfamiliar can pass that would not have passed before.

type Kind = 'mass' | 'unit' | 'meq';
type Amount = { v: number; kind: Kind };
export type Strength =
  | { type: 'amount'; a: Amount }
  | { type: 'conc'; a: Amount; perMl: number; explicit: boolean }   // per mL; explicit = "per 5 mL" was written
  | { type: 'combo'; parts: Amount[] }                               // "400 mg/80 mg", "12.5 mg / 50 mg"
  | { type: 'text'; t: string };

const MASS: Record<string, number> = { g: 1000, mg: 1, mcg: 0.001, 'µg': 0.001, ug: 0.001 };
const UNIT = new Set(['u', 'iu', 'unit', 'units', 'unt']);
const VOL: Record<string, number> = { ml: 1, l: 1000 };

const NUM = String.raw`(\d+(?:\.\d+)?|\.\d+)`;

function amount(num: string, unit: string): Amount | null {
  const u = unit.toLowerCase();
  const v = parseFloat(num);
  if (!isFinite(v)) return null;
  if (u in MASS) return { v: v * MASS[u], kind: 'mass' };
  if (UNIT.has(u)) return { v, kind: 'unit' };
  if (u === 'meq') return { v, kind: 'meq' };
  return null;
}

const norm = (s: string) => s.replace(/\s+/g, '').toLowerCase();

export function parseStrength(text: string): Strength {
  const s = text.trim().toLowerCase();
  const amt = String.raw`${NUM}\s*([a-zµ]+)`;
  // Concentration: 250 mg/5 mL, 50 mg/mL, 100 units/mL, 1 g/L
  let m = s.match(new RegExp(String.raw`^${amt}\s*(?:/|per)\s*(\d+(?:\.\d+)?)?\s*(ml|l)$`));
  if (m) {
    const a = amount(m[1], m[2]);
    const vol = (m[3] ? parseFloat(m[3]) : 1) * VOL[m[4]];
    if (a && vol > 0) return { type: 'conc', a: { v: a.v / vol, kind: a.kind }, perMl: 1, explicit: !!m[3] && parseFloat(m[3]) !== 1 };
  }
  // Combination: 400 mg/80 mg, 12.5 mg / 50 mg
  const parts = s.split(/\s*\/\s*/);
  if (parts.length > 1) {
    const amts = parts.map((p) => p.match(new RegExp(`^${amt}$`))).map((x) => (x ? amount(x[1], x[2]) : null));
    if (amts.every(Boolean)) return { type: 'combo', parts: amts as Amount[] };
  }
  m = s.match(new RegExp(`^${amt}$`));
  if (m) {
    const a = amount(m[1], m[2]);
    if (a) return { type: 'amount', a };
  }
  return { type: 'text', t: norm(text) };
}

const same = (x: Amount, y: Amount) => x.kind === y.kind && Math.abs(x.v - y.v) <= 1e-9 * Math.max(Math.abs(x.v), Math.abs(y.v), 1e-12);

/** Is the written strength one of the listed ones? */
export function isListedStrength(written: string, listed: string[]): boolean {
  const w = parseStrength(written);
  return listed.some((l) => matches(w, parseStrength(l), written, l));
}

function matches(w: Strength, l: Strength, wText: string, lText: string): boolean {
  if (w.type === 'text' || l.type === 'text') return norm(lText).startsWith(norm(wText));
  if (w.type === 'amount') {
    if (l.type === 'amount') return same(w.a, l.a);
    // A bare amount against a liquid matches its numerator as written ("120 mg" for "120 mg/5 mL"),
    // and the first part of a combination ("800 mg" for "800 mg/160 mg"), as the text check did.
    if (l.type === 'conc') return l.explicit ? same(w.a, numerator(lText) ?? l.a) : same(w.a, l.a);
    return same(w.a, l.parts[0]);
  }
  if (w.type === 'conc') return l.type === 'conc' && same(w.a, l.a);
  return l.type === 'combo' && w.parts.length === l.parts.length && w.parts.every((p, i) => same(p, l.parts[i]));
}

function numerator(text: string): Amount | null {
  const m = text.trim().toLowerCase().match(new RegExp(String.raw`^${NUM}\s*([a-zµ]+)`));
  return m ? amount(m[1], m[2]) : null;
}
