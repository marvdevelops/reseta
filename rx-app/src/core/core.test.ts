import { describe, expect, it } from 'vitest';
import { blockers, buildDraft, type Line } from './draft';
import { matchDrug, tallMan } from './match';
import { parseSig, timesFor } from './sig';
import { buildIcs, makeSample, type Card } from './model';
import { isListedStrength } from './strength';

const ink = (id: string, text: string, conf = 90): Line => ({ id, crop: `file://${id}.jpg`, text, read: true, typed: false, machine: text, conf });
const typed = (id: string, text: string): Line => ({ id, crop: null, text, read: true, typed: true });

describe('sig parsing', () => {
  it('reads a typical Philippine sig', () => {
    const s = parseSig('Amlodipine 5 mg 1 tab OD x 30 days #30');
    expect(s.strength?.v).toBe('5 mg');
    expect(s.dose).toBe('1 tab');
    expect(s.freq?.code).toBe('OD');
    expect(s.days).toBe(30);
    expect(s.qty).toBe(30);
  });
  it('keeps TID and Q8H apart', () => {
    expect(timesFor('TID', { wake: '07:00', bed: '21:00' })).toEqual(['08:00', '14:30', '20:00']);
    expect(timesFor('Q8H', { wake: '07:00', bed: '21:00' })).toEqual(['08:00', '16:00', '00:00']);
  });
});

describe('drug matching', () => {
  it('maps a brand to its generic', () => {
    expect(matchDrug('Biogesic 500mg')[0].drug.n).toBe('paracetamol');
  });
  it('shows look-alikes in Tall Man letters', () => {
    expect(tallMan('hydroxyzine', 'hydralazine')).toBe('hydrOXYzine / hydrALAzine');
  });
});

describe('safety rules', () => {
  it('rule 16: a handwritten drug name is never Green', () => {
    const f = buildDraft([ink('a', 'Amlodipine 5 mg'), ink('b', '1 tab BID')])!;
    expect(f.drug.value).toBe('amlodipine');
    expect(f.drug.state).not.toBe('g');
  });
  it('rule 4: look-alike names force a choice with nothing preselected', () => {
    const f = buildDraft([ink('a', 'Hydroxyzine 25 mg 1 tab HS')])!;
    expect(f.drug.choices).toEqual(['hydroxyzine', 'hydralazine']);
    expect(f.drug.value).toBe('');
    expect(blockers(f)).toContain('Medicine: choose one of the two names.');
  });
  it('rule 4: an exactly typed name does not force a look-alike choice', () => {
    expect(buildDraft([typed('a', 'Losartan 50 mg 1 tab OD')])!.drug.choices).toBeNull();
  });
  it('rule 4: a handwritten prednisone forces the prednisolone choice', () => {
    expect(buildDraft([ink('a', 'Prednisone 10 mg 1 tab OD')])!.drug.choices).toEqual(['prednisone', 'prednisolone']);
  });
  it('rule 6: an unlisted strength is Red and is not corrected', () => {
    const f = buildDraft([typed('a', 'Amlodipine 50 mg 1 tab OD')])!;
    expect(f.strength.state).toBe('r');
    expect(f.strength.value).toBe('50 mg');
  });
  it('rule 5: a decimal strength must be typed', () => {
    const f = buildDraft([typed('a', 'Carvedilol 6.25 mg 1 tab BID')])!;
    expect(f.strength.mustType).toBe(true);
  });
  it('rule 8: methotrexate read as daily is Red', () => {
    const f = buildDraft([typed('a', 'Methotrexate 2.5 mg 1 tab OD')])!;
    expect(f.freq.state).toBe('r');
  });
  it('a misread schedule ("o>") blocks the card', () => {
    const f = buildDraft([ink('a', 'Amlodipine 5 mg', 38), ink('b', '1 tab o> x 20 days', 84)])!;
    expect(f.freq.state).toBe('r');
    expect(blockers(f).some((b) => b.startsWith('How often'))).toBe(true);
  });
  it('a handwritten duration is Amber and shows the written quantity', () => {
    const f = buildDraft([ink('a', 'Amlodipine 5 mg'), ink('b', '1 tab OD x 20 days'), ink('c', '#30')])!;
    expect(f.days.state).toBe('a');
    expect(f.days.reason).toContain('#30');
  });
  it('each field shows the ink it came from ("od" inside amlodipine is not a schedule)', () => {
    const f = buildDraft([ink('a', 'Amlodipine 5 mg'), ink('b', '1 tab OD x 30 days'), ink('c', '#30')])!;
    expect(f.drug.lineId).toBe('a');
    expect(f.freq.lineId).toBe('b');
    expect(f.days.lineId).toBe('b');
  });
  it('a doubtful handwritten duration must be ticked before saving', () => {
    const f = buildDraft([ink('a', 'Amlodipine 5 mg'), ink('b', '1 tab BID x 20 days'), ink('c', '#30')])!;
    for (const k of ['drug', 'strength', 'dose', 'freq'] as const) f[k].confirmed = true;
    expect(blockers(f)).toContain('For how many days: tap "Matches the paper".');
    f.days.confirmed = true;
    expect(blockers(f)).toEqual([]);
  });
  it('rule 1: nothing can be saved until critical fields are confirmed', () => {
    const f = buildDraft([typed('a', 'Losartan 50 mg 1 tab OD')])!;
    expect(blockers(f).length).toBeGreaterThan(0);
    for (const k of ['drug', 'strength', 'dose', 'freq'] as const) f[k].confirmed = true;
    expect(blockers(f)).toEqual([]);
  });
});

describe('strength check', () => {
  // RxNorm writes micrograms as milligrams and liquids per mL.
  it('matches micrograms against milligrams', () => {
    expect(isListedStrength('50 mcg', ['0.025 mg', '0.05 mg'])).toBe(true);
    expect(isListedStrength('0.5 mg', ['500 mcg'])).toBe(true);
  });
  it('keeps a thousandfold slip out', () => {
    expect(isListedStrength('500 mcg', ['5 mg', '50 mg'])).toBe(false);
    expect(isListedStrength('50 mg', ['0.05 mg'])).toBe(false);
  });
  it('matches a per-5 mL liquid against per mL', () => {
    expect(isListedStrength('250 mg/5 mL', ['25 mg/mL', '50 mg/mL'])).toBe(true);
    expect(isListedStrength('125 mg/5 mL', ['50 mg/mL'])).toBe(false);
    expect(isListedStrength('100 units/mL', ['100 units/mL'])).toBe(true);
  });
  it('keeps the bare-amount matches the text check allowed', () => {
    expect(isListedStrength('120 mg', ['500 mg', '120 mg/5 mL'])).toBe(true);
    expect(isListedStrength('800 mg', ['400 mg/80 mg', '800 mg/160 mg'])).toBe(true);
    expect(isListedStrength('5 mg', ['50 mg', '10 mg'])).toBe(false);
  });
  it('falls back to text for units it does not know', () => {
    expect(isListedStrength('100 mcg/dose', ['2 mg', '100 mcg/dose'])).toBe(true);
    expect(isListedStrength('0.4 mg/actuation', ['0.4 mg/actuation'])).toBe(true);
  });
  it('reads a liquid strength with its volume, and the dose separately', () => {
    const s = parseSig('Amoxicillin 250mg/5ml 5 ml TID x 7 days');
    expect(s.strength?.v).toBe('250 mg/5 mL');
    expect(s.dose).toBe('5 ml');
  });
  it('a typed liquid prescription is not blocked by its strength', () => {
    const f = buildDraft([typed('a', 'Amoxicillin 250 mg/5 mL 5 ml TID x 7 days')])!;
    expect(f.strength.value).toBe('250 mg/5 mL');
    expect(f.strength.state).not.toBe('r');
  });
  it('a typed microgram dose of a listed drug is not blocked', () => {
    const f = buildDraft([typed('a', 'Clonidine 0.075 mg 1 tab BID')])!;
    expect(f.strength.state).not.toBe('r');
  });
});

describe('test samples', () => {
  it('keeps the crop, the raw reading and the correction for each inked line only', () => {
    const lines = [{ ...ink('a', '1 tab OD x 30 days', 84), machine: '1 tab o> x 20 days' }, typed('b', 'with food')];
    const s = makeSample(lines, buildDraft(lines), { at: '2026-10-09T00:00:00Z', tester: 'DS-01', version: 1 }, true, 'test')!;
    expect(s.lines).toHaveLength(1);
    expect(s.lines[0]).toMatchObject({ readerA: '1 tab o> x 20 days', readerAConfidence: 84, corrected: '1 tab OD x 30 days' });
    expect(s.tester).toBe('DS-01');
  });
  it('keeps nothing when no line has ink', () => {
    expect(makeSample([typed('a', 'Losartan 50 mg')], null, { at: '', tester: '', version: 1 }, false, 'test')).toBeNull();
  });
});

describe('calendar file', () => {
  it('writes one repeating event with an alert per dose time', () => {
    const card: Card = { id: 'c1', personId: 'p', drug: 'amlodipine', strength: '5 mg', dose: '1 tab', freq: 'OD', days: 30, food: '',
      start: '2026-10-09', times: ['08:00'], every2: false, drugCrop: null, pill: null, lines: [], handwritten: true, confirmedAt: '', version: 1 };
    const ics = buildIcs(card, 'Lola Rosa', new Date('2026-10-09T00:00:00Z'));
    expect(ics).toContain('DTSTART:20261009T080000');
    expect(ics).toContain('RRULE:FREQ=DAILY;COUNT=30');
    expect(ics).toContain('BEGIN:VALARM');
  });
});
