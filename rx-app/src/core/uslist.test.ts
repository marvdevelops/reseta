import { describe, expect, it } from 'vitest';
import pack from '../../assets/packs/rxnorm-us-2026-10-05.app.json';
import { blockers, buildDraft, type Line } from './draft';
import { fromRxNormPack, PH_SAMPLE, type RxNormPack } from './druglist';

const US = fromRxNormPack(pack as unknown as RxNormPack);
const ink = (id: string, text: string, conf = 90): Line => ({ id, crop: `file://${id}.jpg`, text, read: true, typed: false, machine: text, conf });
const typed = (id: string, text: string): Line => ({ id, crop: null, text, read: true, typed: true });

describe('US list (RxNorm pack)', () => {
  it('loads the pack with its notice', () => {
    expect(US.drugs.length).toBeGreaterThan(3000);
    expect(US.notice).toContain('National Library of Medicine');
    expect(US.notice).toContain('2026-10-05');
  });
  it('maps a US brand to its generic', () => {
    const f = buildDraft([typed('a', 'Norvasc 5 mg 1 tab daily')], US)!;
    expect(f.drug.value).toBe('amlodipine');
    expect(f.strength.state).toBe('g');
  });
  it('finds the RxCUI when one product has that strength', () => {
    expect(US.rxcuiFor!('losartan', '50 mg')).toBe('979492');
  });
  it('gives no RxCUI when several products share the strength', () => {
    // amlodipine 5 mg is a tablet and a powder for oral solution
    expect(US.rxcuiFor!('amlodipine', '5 mg')).toBeNull();
  });
  it('never turns instruction words into a drug', () => {
    for (const t of ['Xyzzy 5 mg 1 tab BID', 'Plkmn 500 mg 1 cap TID', 'Qwrtp 10 mg 1 tab daily x 7 days']) {
      const f = buildDraft([typed('a', t)], US)!;
      expect(f.drug.value).toBe('');
      expect(f.drug.choices ?? null).toBeNull();
    }
  });
  it('accepts a microgram strength written against RxNorm milligrams', () => {
    const f = buildDraft([typed('a', 'Synthroid 50 mcg 1 tab daily')], US)!;
    expect(f.drug.value).toBe('levothyroxine');
    expect(f.strength.state).not.toBe('r');
  });
  it('forces the FDA Tall Man look-alike choice on handwriting', () => {
    const f = buildDraft([ink('a', 'Hydroxyzine 25 mg 1 tab HS')], US)!;
    expect(f.drug.choices).toEqual(['hydroxyzine', 'hydralazine']);
    expect(blockers(f)).toContain('Medicine: choose one of the two names.');
  });
  it('keeps the app look-alike pairs RxNorm also has', () => {
    expect(US.lasa).toContainEqual(['metformin', 'metronidazole']);
    expect(US.lasa).toContainEqual(['losartan', 'valsartan']);
  });
  it('never shows a high-alert drug as Green, including combinations', () => {
    expect(US.isHighAlert('insulin lispro')).toBe(true);
    expect(US.isHighAlert('glyburide / metformin')).toBe(true);
    expect(US.isHighAlert('amlodipine')).toBe(false);
    const f = buildDraft([typed('a', 'Warfarin 5 mg 1 tab daily')], US)!;
    expect(f.drug.state).toBe('a');
  });
  it('blocks a strength RxNorm does not list', () => {
    const f = buildDraft([typed('a', 'Amlodipine 50 mg 1 tab daily')], US)!;
    expect(f.strength.state).toBe('r');
  });
  it('explains a miss in US terms', () => {
    expect(buildDraft([typed('a', 'Zzqxv 5 mg 1 tab daily')], US)!.drug.reason).toBe(US.noMatch);
  });
  it('a draft against the US list takes well under a second here', () => {
    const t0 = performance.now();
    buildDraft([ink('a', 'Amlodipne 5 mg'), ink('b', '1 tab OD x 30 days'), ink('c', '#30')], US);
    const ms = performance.now() - t0;
    console.log(`US draft: ${ms.toFixed(0)} ms`);
    expect(ms).toBeLessThan(1000);
  });
  it('leaves the Philippine sample as the default', () => {
    expect(buildDraft([typed('a', 'Biogesic 500 mg 1 tab TID')])!.drug.value).toBe('paracetamol');
    expect(PH_SAMPLE.notice).toBeUndefined();
  });
});
