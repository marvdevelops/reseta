import { fromRxNormPack, PH_SAMPLE, type DrugList, type DrugListId, type RxNormPack } from './core/druglist';

let us: DrugList | null = null;

/** The US list is about 0.9 MB, so it is read only when someone chooses it. */
export async function loadDrugList(id: DrugListId | undefined): Promise<DrugList> {
  if (id !== 'us-rxnorm') return PH_SAMPLE;
  if (!us) us = fromRxNormPack((await import('../assets/packs/rxnorm-us-2026-10-05.app.json')).default as unknown as RxNormPack);
  return us;
}

export const DRUG_LIST_CHOICES: [DrugListId, string][] = [['ph-sample', 'Philippines (sample)'], ['us-rxnorm', 'United States (RxNorm)']];
