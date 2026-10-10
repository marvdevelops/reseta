import { DRUGS, HIGH_ALERT, LASA, type Drug } from './drugs';
import { isListedStrength } from './strength';

/** The names a reading is matched against, and the safety lists that go with them. */
export type DrugList = {
  id: DrugListId;
  label: string;
  drugs: Drug[];
  lasa: [string, string][];
  isHighAlert: (generic: string) => boolean;
  noMatch: string;                       // reason shown when no name in the list fits
  notice?: string;                       // attribution and currency, shown wherever the list is in use
  rxcuiFor?: (generic: string, strength: string) => string | null;
};
export type DrugListId = 'ph-sample' | 'us-rxnorm';

export const PH_SAMPLE: DrugList = {
  id: 'ph-sample',
  label: 'Philippines (sample of about 85 medicines)',
  drugs: DRUGS,
  lasa: LASA,
  isHighAlert: (n) => HIGH_ALERT.has(n),
  noMatch: 'We could not find this name in the medicine list. Philippine prescriptions must show the generic name. Ask your pharmacist, then type the name from the label.',
};

// The app's RxNorm pack (03-rxnorm-licensing/pack, `.app.json`). Products are [rxcui, strength, dose form].
export type RxNormPack = {
  pack: 'rxnorm-us';
  release: string;
  attribution: string;
  currency: string;
  lasa: [string, string][];
  drugs: { n: string; s: string[]; b: string[]; p: [string, string, string][] }[];
};

// US names for the app's high-alert drugs. Every insulin is high-alert, and so is any
// combination that contains one of these. Glyburide is the US name for glibenclamide;
// glipizide and glimepiride are the other US sulfonylureas.
const US_HIGH_ALERT = new Set([
  'warfarin', 'rivaroxaban', 'apixaban', 'tramadol', 'methotrexate',
  'glyburide', 'glipizide', 'glimepiride', 'clopidogrel', 'carbamazepine', 'levetiracetam',
]);

export function fromRxNormPack(pack: RxNormPack): DrugList {
  const byName = new Map(pack.drugs.map((d) => [d.n, d]));
  // FDA Tall Man pairs from the pack, plus the app's own pairs where RxNorm has both names.
  const lasa = [...pack.lasa];
  for (const [a, b] of LASA) {
    if (byName.has(a) && byName.has(b) && !lasa.some((p) => p.includes(a) && p.includes(b))) lasa.push([a, b]);
  }
  return {
    id: 'us-rxnorm',
    label: `United States (RxNorm ${pack.release})`,
    drugs: pack.drugs.map((d) => ({ n: d.n, s: d.s, b: d.b })),
    lasa,
    isHighAlert: (n) => n.split(' / ').some((i) => i.startsWith('insulin') || US_HIGH_ALERT.has(i)),
    noMatch: 'We could not find this name in the US medicine list. Ask your pharmacist, then type the generic name from the label.',
    notice: `${pack.currency} ${pack.attribution}`,
    rxcuiFor: (generic, strength) => {
      const hits = (byName.get(generic)?.p ?? []).filter(([, s]) => isListedStrength(strength, [s]));
      return hits.length === 1 ? hits[0][0] : null;   // several forms at one strength: no single RxCUI
    },
  };
}
