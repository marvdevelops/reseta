import type { FreqCode } from './sig';
import { FREQ_WORDS } from './sig';
import type { Fields, Line } from './draft';
import type { DrugListId } from './druglist';

export type Person = { id: string; name: string; wake: string; bed: string };

export type Card = {
  id: string;
  personId: string;
  drug: string;
  strength: string;
  dose: string;
  freq: FreqCode;
  days: number;          // 0 = until stopped
  food: string;
  start: string;         // YYYY-MM-DD
  times: string[];       // HH:MM
  every2: boolean;
  drugCrop: string | null;
  pill: string | null;
  lines: string[];
  handwritten: boolean;
  confirmedAt: string;
  version: number;
  scheduledIds?: string[];
  drugList?: DrugListId;   // the list the drug name was matched against
  rxcui?: string;          // RxNorm clinical drug, when exactly one matches the drug and strength
};

export type DoseEvent = { at: string; cardId: string; slot: string; status: 'taken' | 'skipped' | 'snoozed' };

export type Sample = {
  id: string;
  at: string;
  tester: string;
  cardSaved: boolean;
  device: string;
  lines: { crop: string; readerA: string | null; readerAConfidence: number | null; readerB: string | null; corrected: string }[];
  fields: Record<string, { suggested: string; final: string; state: string; confirmed: boolean }>;
};

export type Consent = { at: string; tester: string; version: 1 };

export type Store = { people: Person[]; cards: Card[]; log: DoseEvent[]; samples: Sample[]; consent: Consent | null; drugList?: DrugListId };

export const uid = () => Math.random().toString(36).slice(2, 10);

export function makeSample(lines: Line[], fields: Fields | null, consent: Consent, cardSaved: boolean, device: string): Sample | null {
  const withInk = lines.filter((l) => l.crop && l.text.trim());
  if (!withInk.length) return null;
  return {
    id: uid(), at: new Date().toISOString(), tester: consent.tester, cardSaved, device,
    lines: withInk.map((l) => ({ crop: l.crop!, readerA: l.machine ?? null, readerAConfidence: l.conf ?? null, readerB: l.alt ?? null, corrected: l.text.trim() })),
    fields: Object.fromEntries(Object.values(fields ?? {}).map((f) => [f.key, { suggested: f.orig, final: f.value, state: f.state, confirmed: !!f.confirmed }])),
  };
}

/** A calendar file with an alert at every dose time. Used where the app cannot write to the calendar itself. */
export function buildIcs(card: Card, personName: string, now = new Date()): string {
  const stamp = now.toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z';
  const d0 = card.start.replace(/-/g, '');
  const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/[,;]/g, (m) => '\\' + m).replace(/\n/g, '\\n');
  const title = `${personName}: ${card.drug} ${card.strength}`;
  const desc = `${card.dose}, ${FREQ_WORDS[card.freq]}${card.food ? ', ' + card.food : ''}. Confirmed from prescription on ${card.start}.`;
  const count = card.days ? `;COUNT=${Math.ceil(card.days / (card.every2 ? 2 : 1))}` : '';
  const events = card.times.map((t, i) => [
    'BEGIN:VEVENT', `UID:${card.id}-${i}@rxreader`, `DTSTAMP:${stamp}`, `DTSTART:${d0}T${t.replace(':', '')}00`, 'DURATION:PT10M',
    `RRULE:FREQ=DAILY${card.every2 ? ';INTERVAL=2' : ''}${count}`,
    `SUMMARY:${esc(title)}`, `DESCRIPTION:${esc(desc)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, 'TRIGGER:PT0M', 'END:VALARM', 'END:VEVENT',
  ].join('\r\n'));
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//RxReader//EN', 'CALSCALE:GREGORIAN', ...events, 'END:VCALENDAR'].join('\r\n');
}
