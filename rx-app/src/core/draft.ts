import { PH_SAMPLE, type DrugList } from './druglist';
import { dist, matchDrug, tallMan } from './match';
import { parseSig, timesFor } from './sig';
import { isListedStrength } from './strength';

export type State = 'g' | 'a' | 'r';
export const STATE_LABEL: Record<State, string> = { g: 'Looks right', a: 'Check this', r: 'Ask your pharmacist' };

/** One boxed line from the photo (or a typed line). `crop` is an image URI; null for typed lines. */
export type Line = {
  id: string;
  crop: string | null;
  text: string;
  read: boolean;
  typed: boolean;
  machine?: string;   // Reader A's raw text
  conf?: number;      // Reader A's confidence, 0–100
  alt?: string;       // Reader B's text, if run
  disagree?: boolean;
  altPicked?: boolean; // the reader's first guess was set aside for a lower one that names a medicine
};

export type FieldKey = 'drug' | 'strength' | 'dose' | 'freq' | 'days' | 'food';
export type Field = {
  key: FieldKey;
  label: string;
  value: string;
  orig: string;
  state: State;
  reason: string;
  lineId: string | null;   // the ink this value came from
  choices?: string[] | null;
  mustType?: boolean;
  optional?: boolean;
  edited?: boolean;
  confirmed?: boolean;
};
export type Fields = Record<FieldKey, Field>;
export const CRITICAL: FieldKey[] = ['drug', 'strength', 'dose', 'freq'];

const lineWhere = (lines: Line[], pred: (t: string) => boolean) => lines.find((l) => pred(l.text.toLowerCase())) ?? null;

/** Builds the draft card from the line texts. Every field carries a state and a plain reason. */
export function buildDraft(lines: Line[], list: DrugList = PH_SAMPLE): Fields | null {
  const text = lines.map((l) => l.text).join(' \n ');
  if (!text.trim()) return null;
  const handwritten = lines.some((l) => l.crop);
  const ranked = matchDrug(text, list.drugs);
  const top = ranked[0], second = ranked[1];
  const sig = parseSig(text);
  const known = top && top.score <= 0.34 ? top.drug : null;

  // Drug
  const drug: Field = { key: 'drug', label: 'Medicine', value: '', orig: '', state: 'r', reason: '', lineId: null, choices: null };
  if (known) {
    // A forced choice fires when the reading is uncertain (handwriting, or not an exact name)
    // and a look-alike sits within 0.25 of the best match.
    const uncertain = handwritten || top.score > 0.02;
    const pairs = uncertain ? list.lasa.filter((p) => p.includes(known.n)) : [];
    const other = ranked.slice(0, 4).find((r) => r.drug.n !== known.n && pairs.some((p) => p.includes(r.drug.n)) && r.score - top.score < 0.25);
    const close = uncertain && second && second.score - top.score < 0.12 && second.score <= 0.4;
    if (other || close) {
      const alt = (other ?? second).drug.n;
      drug.choices = [known.n, alt];
      drug.reason = `These two names look alike: ${tallMan(known.n, alt)}. Ask your pharmacist which one, then choose it.`;
    } else {
      drug.value = known.n;
      drug.state = handwritten ? 'a' : 'g';
      drug.reason = (top.via !== known.n ? `The paper says "${top.via}", a brand of ${known.n}. ` : '') +
        (handwritten ? 'Handwriting can be misread. Look at the paper and make sure the name is the same.' : 'Found in the medicine list.');
    }
    if (list.isHighAlert(known.n)) {
      if (drug.state === 'g') drug.state = 'a';
      drug.reason += ' This is a high-alert medicine. Ask your pharmacist to check it with you.';
    }
  } else {
    drug.reason = list.noMatch;
  }
  drug.lineId = (lineWhere(lines, (t) => !!top && (t.includes(top.via.slice(0, 4)) || dist(t.split(' ')[0] ?? '', top.via) / top.via.length < 0.5)) ?? lines[0])?.id ?? null;

  // Strength
  const strength: Field = { key: 'strength', label: 'Strength', value: sig.strength?.v ?? '', orig: '', state: 'r', reason: 'No strength found on the paper. Type it from the medicine label.', lineId: null };
  if (sig.strength) {
    const listed = known ? isListedStrength(sig.strength.v, known.s) : false;
    if (known && !listed) {
      const shown = known.s.length > 10 ? `${known.s.slice(0, 10).join(', ')} and ${known.s.length - 10} more` : known.s.join(', ');
      strength.reason = `${sig.strength.v} is not a strength we know for ${known.n} (we know ${shown}). Ask your pharmacist, then type it from the label. Reseta will not guess.`;
    } else if (/\.\d/.test(sig.strength.v) || /(^|\s)\.\d/.test(sig.strength.raw)) {
      strength.state = 'a'; strength.reason = 'This number has a decimal point, which is easy to misread. Type it yourself to confirm.'; strength.mustType = true;
    } else {
      strength.state = known && !handwritten ? 'g' : 'a';
      strength.reason = known ? 'A known strength for this medicine.' : 'We can check the strength once the medicine name is known.';
    }
    if (/\b(u|iu)\b/.test(sig.strength.raw)) { strength.state = 'a'; strength.reason = '"U" or "IU" is easy to misread. Make sure it means units.'; }
  }
  strength.lineId = (lineWhere(lines, (t) => /\d\s*(mg|mcg|g|ml|u|meq)/.test(t)) ?? lines[0])?.id ?? null;

  // Dose
  const fraction = !!sig.dose && /½|half|\//.test(sig.dose);
  const dose: Field = {
    key: 'dose', label: 'How much each time', value: sig.dose ?? '', orig: '',
    state: sig.dose ? (handwritten || fraction ? 'a' : 'g') : 'r',
    reason: sig.dose ? (fraction ? 'This is part of a tablet. Ask your pharmacist how to split it.' : 'Found on the paper.') : 'Not found. Type how much, for example "1 tablet".',
    lineId: (lineWhere(lines, (t) => /(tab|cap|ml|tsp|puff|drop|sachet)/.test(t)) ?? lines[0])?.id ?? null,
  };

  // Frequency
  const freq: Field = { key: 'freq', label: 'How often', value: sig.freq?.code ?? '', orig: '', state: 'r', reason: 'No schedule found on the paper. Choose how often.', lineId: null };
  if (sig.prn) {
    freq.value = 'PRN'; freq.state = 'a'; freq.reason = 'As needed: Reseta keeps a record but sets no alarm. Any limit shown is only what the paper says.';
  } else if (sig.freq) {
    freq.state = handwritten ? 'a' : 'g';
    freq.reason = `The paper says "${sig.freq.raw}", which means ${sig.freq.words}.`;
    if (sig.freq.code === 'OD') { freq.state = 'a'; freq.reason = 'The paper says "OD". It usually means once a day, but it can also mean right eye. Make sure it means once a day.'; }
    if (sig.freq.code === 'QOD') { freq.state = 'a'; freq.reason += ' QOD is easy to misread. Make sure it means every other day.'; }
    if (known?.n === 'methotrexate' && ['OD', 'BID', 'TID', 'QID'].includes(sig.freq.code)) {
      freq.state = 'r'; freq.reason = 'Methotrexate is usually taken once a WEEK. Taking it every day is a known, serious mistake. Ask your pharmacist before you go on.';
    }
  }
  freq.lineId = (lineWhere(lines, (t) => /\b(od|qd|bid|tid|qid|hs|prn|q\s?\d+\s?h|daily|twice|times)\b/.test(t)) ?? lines[lines.length - 1])?.id ?? null;

  // Duration and instruction
  const days: Field = {
    key: 'days', label: 'For how many days', value: sig.days ? String(sig.days) : '', orig: '', optional: true,
    state: sig.days && !handwritten ? 'g' : 'a',
    reason: (sig.days ? 'Found on the paper.' : 'Not written. Leave it empty to keep reminders going until you stop them.') + (sig.qty ? ` The paper also says #${sig.qty}, the number of tablets. Check that the two agree.` : ''),
    lineId: lineWhere(lines, (t) => /(x|for)\s*\d+\s*(d|day|wk|week)/.test(t))?.id ?? null,
  };
  if (sig.qty && sig.days && sig.freq && !sig.prn) {
    const perDay = timesFor(sig.freq.code, { wake: '07:00', bed: '21:00' }).length * (parseFloat(sig.dose ?? '') || 1);
    if (perDay && Math.abs(sig.qty - perDay * sig.days) > perDay) {
      days.state = 'a'; days.reason = `The paper says #${sig.qty} tablets, which does not match ${sig.days} days of this schedule. Reseta will not change it. Check with your pharmacist.`;
    }
  }
  const food: Field = { key: 'food', label: 'How to take it', value: sig.food ?? '', orig: '', optional: true, state: 'g', reason: sig.food ? 'Found on the paper.' : 'Nothing written.', lineId: null };

  const fields: Fields = { drug, strength, dose, freq, days, food };

  // Reader doubt: a low-confidence or disputed line can never yield a Green field.
  for (const f of Object.values(fields)) {
    const src = lines.find((l) => l.id === f.lineId);
    if (src && src.crop && !src.typed) {
      if ((src.conf !== undefined && src.conf < 75) || src.disagree || src.altPicked) {
        if (f.state === 'g') f.state = 'a';
        f.reason += src.disagree ? ' Two readers saw different things on this line.'
          : src.altPicked ? ' The phone was not sure about this line. Look closely at the paper.' : ' The phone was unsure how to read this line.';
      }
    }
    f.orig = f.value;
    f.confirmed = false;
  }
  return fields;
}

/** What still blocks saving. Empty list = the card may be confirmed. */
export function blockers(fields: Fields): string[] {
  const out: string[] = [];
  for (const f of Object.values(fields)) {
    const critical = CRITICAL.includes(f.key);
    if (f.choices?.length) out.push(`${f.label}: choose one of the two names.`);
    if (critical && !f.value) out.push(`${f.label}: not filled in.`);
    if (f.state === 'r' && !f.edited) out.push(`${f.label}: type it from the pharmacist or the label.`);
    if (f.mustType && !f.edited) out.push(`${f.label}: type the number yourself.`);
    // Critical fields always need the tick; any other field read with doubt (not Green) needs it too,
    // because a wrong duration or instruction changes when alarms stop or how the dose is taken.
    if (!f.confirmed && (critical || (f.value && f.state !== 'g'))) out.push(`${f.label}: tap "Matches the paper".`);
  }
  return out;
}
