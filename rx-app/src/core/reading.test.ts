import { describe, expect, it } from 'vitest';
import { customWords, looksLikeMedicineLine, pickReading, readersDisagree } from './reading';
import { DRUGS } from './drugs';
import { buildDraft, type Line } from './draft';

describe('choosing among the reader\'s guesses', () => {
  it('switches to a lower guess that names a listed medicine', () => {
    const r = pickReading(['Amloid pine 5 mg', 'Amlodipine 5 mg', 'Amlodipina 5 mg'], DRUGS);
    expect(r).toEqual({ text: 'Amlodipine 5 mg', altPicked: true });
  });
  it('keeps the first guess when it already names a medicine', () => {
    expect(pickReading(['Metformin 500 mg', 'Metronidazole 500 mg'], DRUGS)).toEqual({ text: 'Metformin 500 mg', altPicked: false });
  });
  it('keeps the first guess for an instructions line', () => {
    expect(pickReading(['1 tab OD x 30 days', '1 tab 0D x 30 days'], DRUGS).text).toBe('1 tab OD x 30 days');
  });
  it('does not switch for a weak match', () => {
    expect(pickReading(['Xyzzy 5 mg', 'Qwerty 5 mg'], DRUGS).altPicked).toBe(false);
  });
  it('a switched reading is never Green, even when typed text would be', () => {
    const line: Line = { id: 'a', crop: 'data:x', text: 'Amlodipine 5 mg', read: true, typed: false, machine: 'Amlodipine 5 mg', conf: 95, altPicked: true };
    const f = buildDraft([line])!;
    expect(f.drug.state).not.toBe('g');
    expect(f.drug.reason).toContain('not sure');
  });
  it('builds the right card from what Apple Vision read on the sample prescription', () => {
    const at = (id: string, variants: string[]): Line => {
      const r = pickReading(variants, DRUGS);
      return { id, crop: 'data:x', text: r.text, read: true, typed: false, machine: variants[0], conf: 100, altPicked: r.altPicked };
    };
    const f = buildDraft([
      at('a', ['Amlodipine 5 mg', 'Amlodipine 5mg']),
      at('b', ['1 tab OD X 30 days', 'I tab OD X 30 days']),
      at('c', ['#30', '#3']),
    ])!;
    expect([f.drug.value, f.strength.value, f.dose.value, f.freq.value, f.days.value]).toEqual(['amlodipine', '5 mg', '1 tab', 'OD', '30']);
    expect(f.drug.state).toBe('a'); // handwritten: never Green
  });
  it('lists medicine names as Vision custom words', () => {
    const w = customWords(DRUGS);
    expect(w).toContain('Amlodipine');
    expect(w).toContain('Biogesic');
  });
});

describe('finding the medicine lines on a page', () => {
  it('suggests drug, strength and instruction lines', () => {
    for (const t of ['Amlodipine 5 mg', '1 tab OD x 30 days', '#30', 'Biogesic 500mg', 'Metformin']) expect(looksLikeMedicineLine(t, DRUGS)).toBe(true);
  });
  it('leaves out the patient, the doctor and the date', () => {
    for (const t of ['Pt: Rosa Cruz 10/08/26', 'Dr. M. Santos - Quezon City', 'RX', 'Lic. No. 012345', 'Age: 72']) expect(looksLikeMedicineLine(t, DRUGS)).toBe(false);
  });
});

describe('comparing the two readers', () => {
  it('ignores case and spacing', () => {
    expect(readersDisagree('1 tab OD X 30 days', '1 tab od x 30 days', DRUGS)).toBe(false);
  });
  it('flags a different number', () => {
    expect(readersDisagree('1 tab OD x 30 days', '1 tab OD x 20 days', DRUGS)).toBe(true);
    expect(readersDisagree('Amlodipine 5 mg', 'Amlodipine 10 mg', DRUGS)).toBe(true);
  });
  it('flags a different medicine', () => {
    expect(readersDisagree('Metformin 500 mg', 'Metronidazole 500 mg', DRUGS)).toBe(true);
  });
  it('accepts a small spelling slip that names the same medicine', () => {
    expect(readersDisagree('Amlodipine 5 mg', 'Amlodipne 5 mg', DRUGS)).toBe(false);
  });
  it('a disagreement turns the field into Check this', () => {
    const line: Line = { id: 'a', crop: 'data:x', text: '1 tab OD x 30 days', read: true, typed: false, conf: 100, alt: '1 tab OD x 20 days', disagree: true };
    const f = buildDraft([{ id: 'm', crop: 'data:x', text: 'Amlodipine 5 mg', read: true, typed: false, conf: 100 }, line])!;
    expect(f.days.state).toBe('a');
    expect(f.days.reason).toContain('Two readers');
  });
});

