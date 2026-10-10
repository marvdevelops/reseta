export type FreqCode = 'OD' | 'BID' | 'TID' | 'QID' | 'HS' | 'Q4H' | 'Q6H' | 'Q8H' | 'Q12H' | 'QOD' | 'PRN';
export const FREQ_CODES: FreqCode[] = ['OD', 'BID', 'TID', 'QID', 'HS', 'Q4H', 'Q6H', 'Q8H', 'Q12H', 'QOD', 'PRN'];

export const FREQ_WORDS: Record<FreqCode, string> = {
  OD: 'once a day', BID: 'twice a day', TID: 'three times a day', QID: 'four times a day', HS: 'at bedtime',
  Q4H: 'every 4 hours', Q6H: 'every 6 hours', Q8H: 'every 8 hours', Q12H: 'every 12 hours',
  QOD: 'every other day', PRN: 'as needed',
};

export type Sig = {
  strength?: { v: string; raw: string };
  dose?: string;
  freq?: { code: FreqCode; words: string; raw: string };
  prn?: boolean;
  days?: number;
  qty?: number;
  route?: string;
  food?: string;
};

const FREQ_PATTERNS: [RegExp, FreqCode][] = [
  [/\b(qid|4x a day|4x\/day|four times)\b/, 'QID'],
  [/\b(tid|3x a day|3x\/day|three times)\b/, 'TID'],
  [/\b(bid|2x a day|2x\/day|twice)\b/, 'BID'],
  [/\bq\s?4\s?h(rs?)?\b/, 'Q4H'],
  [/\bq\s?6\s?h(rs?)?\b/, 'Q6H'],
  [/\bq\s?8\s?h(rs?)?\b/, 'Q8H'],
  [/\bq\s?12\s?h(rs?)?\b/, 'Q12H'],
  [/\b(hs|at bedtime|bedtime)\b/, 'HS'],
  [/\b(qod|every other day)\b/, 'QOD'],
  [/\b(od|qd|once a day|once daily|daily|1x a day)\b/, 'OD'],
];

/** Pulls sig parts out of free text. Finds; never corrects. */
export function parseSig(text: string): Sig {
  // Keep decimal points inside numbers (6.25 mg); drop other punctuation.
  const s = ' ' + text.toLowerCase().replace(/(?<!\d)\.|\.(?!\d)|[,;]/g, ' ') + ' ';
  const out: Sig = {};
  // A liquid's strength keeps its volume: "250 mg/5 ml" is one strength, not 250 mg plus a 5 mL dose.
  const str = s.match(/(\d+(?:\.\d+)?)\s*(mg|mcg|µg|ug|g|ml|units?|iu|u|meq)\b(?:\s*(?:\/|per)\s*(\d+(?:\.\d+)?)?\s*(ml|l)\b)?/);
  if (str) {
    const unit = str[2].replace('ug', 'mcg').replace('µg', 'mcg').replace(/^units?$/, 'units').replace(/^ml$/, 'mL').replace('meq', 'mEq');
    const per = str[4] ? `/${str[3] ? str[3] + ' ' : ''}${str[4] === 'ml' ? 'mL' : 'L'}` : '';
    out.strength = { v: `${str[1]} ${unit}${per}`, raw: str[0] };
  }
  const dose = (str?.[4] ? s.replace(str[0], ' ') : s).match(/\b(\d+(?:\/\d+)?|½|one|two|half)\s*(tabs?|tablets?|caps?|capsules?|ml|tsp|puffs?|drops?|sachets?)\b/);
  if (dose) out.dose = dose[0].trim();
  for (const [re, code] of FREQ_PATTERNS) {
    const m = s.match(re);
    if (m) { out.freq = { code, words: FREQ_WORDS[code], raw: m[0].trim() }; break; }
  }
  if (/\bprn\b|as needed|if needed/.test(s)) out.prn = true;
  const dur = s.match(/(?:x|for)\s*(\d+)\s*(days?|d|weeks?|wks?)\b/);
  if (dur) out.days = +dur[1] * (/^w/.test(dur[2]) ? 7 : 1);
  const qty = s.match(/#\s*(\d+)/);
  if (qty) out.qty = +qty[1];
  if (/\bpo\b|by mouth|orally/.test(s)) out.route = 'by mouth';
  if (/\b(pc|after meals?|with food|after eating)\b/.test(s)) out.food = 'after meals';
  if (/\b(ac|before meals?)\b/.test(s)) out.food = 'before meals';
  return out;
}

export const toMin = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const toHM = (m: number) => {
  m = ((Math.round(m) % 1440) + 1440) % 1440;
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
};

/** Default dose times from a person's wake and bed times. The user can change them before confirming. */
export function timesFor(code: FreqCode | '', person: { wake: string; bed: string }): string[] {
  const w = toMin(person.wake || '07:00'), b = toMin(person.bed || '21:00');
  const span = b - w;
  switch (code) {
    case 'OD': case 'QOD': return [toHM(w + 60)];
    case 'BID': case 'Q12H': return [toHM(w + 60), toHM(w + 60 + 720)];
    case 'TID': return [toHM(w + 60), toHM(w + 60 + span / 2 - 30), toHM(b - 60)];
    case 'QID': return [0, 1, 2, 3].map((i) => toHM(w + 60 + (i * (span - 120)) / 3));
    case 'Q4H': return [0, 1, 2, 3, 4, 5].map((i) => toHM(w + 60 + i * 240));
    case 'Q6H': return [0, 1, 2, 3].map((i) => toHM(w + 60 + i * 360));
    case 'Q8H': return [0, 1, 2].map((i) => toHM(w + 60 + i * 480));
    case 'HS': return [toHM(b - 30)];
    default: return [];
  }
}
