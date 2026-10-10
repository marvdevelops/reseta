import { describe, expect, it } from 'vitest';
import { fmtTime, plainDose, takeLine } from './format';

describe('plain words for times and amounts', () => {
  it('shows the 12-hour clock', () => {
    expect(fmtTime('08:00')).toBe('8:00 AM');
    expect(fmtTime('21:30')).toBe('9:30 PM');
    expect(fmtTime('00:00')).toBe('12:00 AM');
    expect(fmtTime('12:00')).toBe('12:00 PM');
  });
  it('spells out prescription shorthand for amounts', () => {
    expect(plainDose('1 tab')).toBe('1 tablet');
    expect(plainDose('2 tabs')).toBe('2 tablets');
    expect(plainDose('1 cap')).toBe('1 capsule');
    expect(plainDose('½ tab')).toBe('half a tablet');
    expect(plainDose('5 ml')).toBe('5 mL');
    expect(plainDose('2 tsp')).toBe('2 teaspoons');
  });
  it('writes the instruction as a sentence', () => {
    expect(takeLine('1 tab', 'after meals')).toBe('Take 1 tablet, after meals');
  });
});
