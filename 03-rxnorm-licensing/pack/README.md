# US drug-name pack (RxNorm)

`build_rxnorm_pack.py` turns an RxNorm Current Prescribable Content release into the
pack the app matches readings against. It uses the standard library only and runs in
about 4 seconds.

```bash
python3 build_rxnorm_pack.py ../RxNorm_full_prescribe_10052026 out/ ../../fda_tall_man_lettering_2026-06-12.csv
cp out/rxnorm-us-2026-10-05.app.json ../../rx-app/assets/packs/
```

## Output

- `out/rxnorm-us-2026-10-05.json`: 3.8 MB, 3,332 generics, 12,081 clinical drugs,
  8,094 branded drugs, 4,140 brand names.
- `out/rxnorm-us-2026-10-05.app.json`: 0.9 MB, the copy the app loads. Per product it
  keeps only RxCUI, strength and dose form.
- `out/rxnorm-us-2026-10-05.manifest.json`: SHA-256 and byte size of both files,
  counts and exclusions. The pack is **not signed**: no signing key exists yet.

Each `drugs[]` entry has the fields the app's matcher reads (`n` generic, `s`
strengths, `b` brands, all lower case), plus:

- `tm`: Tall Man form of the generic, from RxNorm's TMSY names (138 generics have one);
- `in`: ingredient RxCUIs;
- `p`: one row per clinical drug, with `rxcui`, `s`, `f` (dose form), `name`, `psn`
  (prescribable name), `tm` and `sbd` (branded versions with their RxCUIs).

`lasa` holds 18 look-alike pairs: names FDA's Tall Man list groups together, where both
are generics in the pack. Five Tall Man names are not in RxNorm's prescribable list
(acetohexamide, chlorpropamide, sulfisoxazole, tolazamide, tolbutamide), so their
partners have no pair.

Combination drugs are one entry named by their ingredients in alphabetical order, the
way RxNorm names them: `hydrochlorothiazide / losartan`, brand `hyzaar`.

## What goes in

- Only `SAB=RXNORM` rows. The 105,943 MTHSPL label rows and the 11 MTHCMSFRF supply
  rows are skipped.
- Every clinical drug except veterinary-only ones. This release has none. Four drugs
  carry neither a human nor a veterinary flag (no current US marketing data); they
  are kept, because leaving a real drug out would turn its prescriptions Red.

## Checked

Ran the app's own matcher (`rx-app/src/core/match.ts`) over the pack on 10 inputs.
All 10 found the right generic at score 0.00, or 0.10 for the misspelt "amlodipne".
Brands resolved to generics: Norvasc, Lipitor, Synthroid, Zoloft, and Hyzaar to
`hydrochlorothiazide / losartan`. Look-alikes rank second: hydralazine (0.22) after
hydroxyzine. Each lookup took 40–200 ms on this Mac against all 3,332 generics.

## Using it in the app

- **Strengths are compared by quantity** (`rx-app/src/core/strength.ts`). RxNorm states
  micrograms as decimal milligrams (levothyroxine 50 mcg is `0.05 mg`) and liquids per
  mL (`amoxicillin 50 mg/mL`). The check converts both, so "50 mcg" and "250 mg/5 mL"
  match, and "500 mcg" against `5 mg` does not.
- **Strengths are listed per generic, not per dose form.** "Levothyroxine 500 mcg"
  passes because RxNorm lists a 500 mcg injection, though no tablet exists at that
  strength. Matching the strength to the form written needs the form read off the
  prescription first.
- **The app loads it as a second drug list** (`rx-app/src/core/druglist.ts`), chosen on
  the Scan screen. The Philippine sample stays the default.
- **Speed.** A full draft against the pack takes about 56 ms on a Mac. A phone will be
  slower; measure it before shipping. The Scan screen waits for typing to pause
  (250 ms) before matching against this list.
- **Attribution and currency.** The pack carries NLM's required attribution statement
  and the release date. NLM's terms require the app to show the statement, and to
  say clearly when its data isn't NLM's current release.
- **Signing.** Decide the key and where it lives before the pack ships in an app.
