# Rx Reader & Med Alarms: Product Spec

Oct 9, 2026 · @David Sakach

## Summary

Build a careful reader for the Philippines first, on iPhone first, with the US as the second market. The phone reads the paper, the user confirms every field beside its ink, and only a confirmed card sets alarms.

- **Market.** Philippines first. 86.5% of Philippine phones run Android (StatCounter, Sep 2026), prescriptions are routinely handwritten, and no general e-prescribing mandate exists. Every Philippine competitor found uploads prescription photos to a server; none reads on the device. The US is second and label-led, since 94% of US prescriptions were electronic in 2021.
- **Stack.** One React Native app (Expo, TypeScript) for both phones, released on iPhone (iOS 26+) first and Android (10+) second. The safety rules live in one shared TypeScript core, and about five small native modules cover alarms, the scanner, the text reader and the model runtime.
- **Local model.** An open vision model shipped with the app and run by llama.cpp: Qwen3.5-2B or Qwen3-VL-2B on 8 GB phones, a 1B-class model on 6 GB phones, all Apache 2.0 or MIT. A 6-week bake-off on real phones picks the winner.
- **Not the phone makers' built-in models.** Their terms treat medical use as high-risk. Google's Gemini Nano also runs on only 68 phone models, mostly flagships few Filipino buyers own.
- **Behind the app.** No patient data. A monthly job builds a signed drug-name pack from the Philippine National Formulary and the FDA Philippines product list (reuse terms still to confirm), plus RxNorm for the US. There are no accounts, no sync and no analytics SDKs.
- **Biggest risk: handwriting.** The best frontier models score 47–58% F1 on handwritten medicine fields, and most of their errors are plausible wrong words. So handwritten drug names are never auto-trusted, and Gate A can turn v1 label-first.
- **Second risk: reach. iPhone first reaches only the 13.5% of Philippine phones that run iOS, so Android has to follow fast, and budget Android is where alarms fail.** Transsion brands (TECNO, Infinix, itel) sell a third of Philippine phones, and most big brands kill background apps. Alarms need the exact-alarm permission, a battery exemption and missed-alarm detection.
- **Cost and time (estimate).** $495k–$695k and 28 weeks to both platforms, with iPhone shipping at week 22 and Android at week 28.

## Prototype

A free prototype runs today in any phone browser, with no account, no server and no API cost: [Rx Reader Prototype](https://claude.ai/artifact/6WxoVkvZdDeujq1PMSxq8a). Its Test data tab asks the tester for consent, keeps each checked line crop with the reader's text and the corrected text on the phone, and exports them as a JSON file for the Phase 0 test set. It tests the flow, not the final models.

- **What it does.**
  - Take a photo, then drag a box around each medicine line.
  - Reader A (Tesseract.js) reads each line in the browser and reports its confidence.
  - An optional Reader B (TrOCR-small-handwritten) gives a second reading, and any disagreement lowers that line's state.
  - The card shows each field beside its ink crop with a Green, Amber or Red state.
  - The gate blocks saving until every critical field is confirmed and every Red field is fixed.
  - Look-alike names force a choice. Handwritten drug names are never Green, and unlisted strengths and methotrexate taken daily are Red.
- **Alarms.** "Add to phone calendar" downloads a calendar file with an alert at every dose time, so the phone's own calendar rings even when the page is closed. While the page is open, a dose screen shows the person, the dose, the ink crop and the pill photo, with Taken, Snooze and Skip, and reads the card aloud.
- **Data.** Everything stays in the browser on that phone. The drug list is a sample of about 85 common Philippine generics and brands.
- **Tested on a sample handwritten-style prescription.**
  - Reader A read "Amlodipine 5 mg" and "#30" correctly.
  - It misread "OD" as "o>". The schedule went Red and nothing could be saved until it was fixed.
  - It misread "30 days" as "20 days". Handwritten durations are therefore Amber and shown beside the written quantity.
  - TrOCR-small produced invented words ("autobiographical success") on the same lines. That is the language-prior failure the Local models section warns about.
- **What it does not prove.** Accuracy on real Filipino doctors' handwriting. The prototype is how to start collecting that test set. **React Native version.** The same flow runs as an Expo app in TypeScript. Its safety core is the shared TypeScript core this spec describes, covered by 18 automated tests. It runs on the web and in Expo Go. In Expo Go it writes dose alarms as phone notifications and as calendar events with alerts. On-device reading needs the planned native modules; until then, users type each line beside its crop.

## Product

The app does one job. It turns a prescription on paper into alarms that say who takes what, how much and when, and the paper's contents never leave the phone.

**Who it is for**

- Caregivers who manage medicines for someone else, such as a parent, a child or a partner. Every card and every alarm names the person.
- Older adults on several medicines who need large type, spoken instructions and a photo of the pill.
- Anyone handed a handwritten note they cannot read with confidence.

**What v1 does**

- Scans a handwritten note, a printed prescription, a discharge sheet or a pharmacy label, and straightens the image on the phone.
- Reads the image on the phone into one draft card per medicine. Each field sits beside the ink it came from and shows a doubt state.
- Makes the user confirm the card field by field. A blocked field stops scheduling.
- Keeps a profile per person. Alarms carry the person's name, the dose and the instruction, and read them aloud on request.
- Sets either an alarm or a quieter reminder for each card. Shows the pill or bottle photo when it fires, and logs Taken, Skipped or Snoozed on the phone.
- Compares a later photo of the bottle label with the confirmed card. A mismatch is flagged and the alarm stays as it is.
- Flags the same ingredient on two active cards for one person.
- Tracks refills and the stop date. Exports the dose log as a PDF, but only when the user taps Share.

**Later**

- Drug-interaction warnings. These need a licensed database (see Data sources).
- Automatic reading of tapers and other multi-step schedules. In v1 the app does not read them and the user builds each step by hand.
- Caregiver sharing across phones, end-to-end encrypted.
- Opt-in donation of corrected reads to improve the models.
- Watch apps, more languages and more markets.

**Never**

- Recommends, changes or "corrects" a dose.
- Says a medicine is safe, or clears anyone to take it.
- Sends the photo, the card or the schedule to a server.
- Schedules an alarm from a field the user did not confirm.
- Picks between drug names that look alike.
- Handles insulin sliding scales or chemotherapy regimens.

## How it works

*Diagram: photo to alarm, 9 steps and 1 gate. See this section in `PRODUCT-SPEC.pdf`.*

Steps 1 to 5 are allowed to be wrong, because nothing they produce reaches the scheduler until the user confirms it at step 6. A bottle label can mark a card and its alarms, but it never edits them.

## The card

Each medicine becomes one card. A card stays a draft until every required field is confirmed, and only a confirmed card can own alarms.

| Field | Example | Comes from | Needed for an alarm | Stops or warns when |
| --- | --- | --- | --- | --- |
| Person | Rosa | The user picks. The name on the paper is compared | Yes | Amber: the name on the paper is different |
| Drug | metformin | Ink, matched to drug-name candidates | Yes | Red: no match, a look-alike pair, or the readers disagree |
| Strength | 500 mg | Ink | Yes | Red: strength not listed for that drug and form. Amber: a decimal point or trailing zero |
| Form | tablet | Ink, or the forms listed for that strength | Yes | Amber: more than one form fits |
| Dose | 1 tablet | Ink | Yes | Red: missing. Amber: a fraction such as ½ |
| Route | by mouth | Ink (po, sl, top, gtt) | Yes | Amber: eye or ear abbreviations (OD, OS, OU, AD, AS, AU) |
| How often | twice a day | Ink (bid, tid, q8h, qhs) | Yes | Amber: QD or QOD, confirmed in words. Red: the readers disagree |
| With food, at bedtime | with food | Ink | No | None |
| As needed | for pain, up to 4 a day | Ink | No. It is logged, not alarmed | Amber: no maximum is written. The card shows "not written" and the app never computes one |
| How long | 10 days | Ink, or the days' supply on the label | No. The default is until stopped | Amber: the quantity and the schedule disagree |
| Quantity, refills | 20 tablets, 2 refills | Ink or label | No | None |
| Prescriber, date written | Dr. Lee, Oct 2 2026 | Ink | No | Amber: written more than 12 months ago |
| Rx number, pharmacy | 0412345, pharmacy phone | Label only | No | None |

The card follows the FHIR R4 Dosage and Timing structures. That keeps "three times a day" and "every 8 hours" apart: TID is 3 doses across the waking day, while Q8H is one dose every 8 hours, around the clock.

Every confirmed field keeps three things: the box around its ink, both readers' outputs, and who confirmed it and when. Editing a confirmed card creates a new version, and the alarms move to that version only after it is confirmed. Default dose times come from the person's profile (wake, meals, bed). The user can move any of them before confirming.

Philippine prescriptions must name the generic drug ([RA 6675](https://www.chanrobles.com/republicactno6675.htm)), usually with the brand in parentheses. The reader parses both, matches on the generic, and shows the brand only as a cross-check. A prescription with no generic name is one a Philippine pharmacist must not fill, so the app marks the drug Red and says so.

## Safety rules

Sixteen rules live in the shared core, not in the screens, so both apps enforce the same ones. Each rule has an automated test that tries to break it.

1. **No alarm without a confirmed card.** The scheduler accepts only confirmed card versions. No code path runs from a model output to an alarm.
2. **Every value points to ink.** A value with no source box on the photo is not shown. Instead the field says "Not found on the paper."
3. **Critical fields are confirmed one at a time.** Drug, strength, dose and how often have no "accept all" button.
4. **Look-alike names force a choice.** Some names are too close to call, or ISMP or FDA lists them as look-alikes. For those the app preselects neither name. Both show in Tall Man letters (hydrOXYzine, hydrALAZINE) with "Ask your pharmacist which one."
5. **Error-prone notation is spelled out.** The user confirms the meaning in words for:
   - QD, QOD, U and IU;
   - trailing zeros (5.0 mg) and naked decimals (.5 mg);
   - µg, cc and OD/OS/OU.

   The user must type any strength with a decimal point, not just tap it.
6. **An unlisted strength blocks.** If a strength is not listed for that drug and form, the field is Red. The app never suggests the nearest strength.
7. **Disagreement escalates.** If the readers disagree on the drug, the field is Red. If they disagree on any other critical field, it is at least Amber.
8. **High-alert drugs add a pharmacist check.** These fields are never Green: insulin, blood thinners, opioids, sulfonylureas, oral methotrexate and some antiepileptics, the classes ISMP flags for community settings. Oral methotrexate read as daily is Red.
9. **Some regimens are refused.** Insulin sliding scales and chemotherapy regimens get no card. Tapers are never read automatically; the user builds each step by hand.
10. **The same ingredient twice is flagged.** If two active cards for one person share an ingredient, both are marked Amber.
11. **A label clash never moves an alarm.** A bottle label that disagrees with the card marks the card and every alarm screen. The mark stays until the user resolves it, and the app does not pick a side.
12. **The paper cannot give orders.** Text read off the photo is data, never instructions (this blocks prompt injection). The structurer can only emit the card schema, and any value outside the schema's allowed lists is dropped.
13. **No safety verdicts in the copy.** Every string is checked against a banned list ("safe", "OK to take", "correct dose"). A hit fails the build.
14. **Time-zone changes never move doses silently.** After a zone change, the app asks whether to keep home times or switch to local times.
15. **Nothing leaves the phone.** The only network calls are signed content-pack downloads and store billing. A CI test runs the full pipeline under a network monitor and fails on any other request.
16. **Handwritten drug names are never Green.** Readers share language habits and can agree on the same plausible but wrong name, so the user always compares the drug name with its ink crop.

## Doubt score

Five signals put each field into one of three states. The user sees the state and a reason in words, never a percentage.

| Signal | What it checks | Comes from |
| --- | --- | --- |
| Ink confidence | How confident the first reading is, and how far ahead of the second reading it is | Reader A's ranked candidates |
| Agreement | Whether two independent readers give the same value after normalizing | Reader A vs. Reader B |
| Name fit | How far the reading is from the nearest drug name, and the gap to the runner-up. Common handwriting confusions (rn/m, cl/d, 1/l, 0/O, 5/S) count for less distance | Drug-name pack |
| Plausibility | Whether the strength is listed for that drug and form, the frequency parses, and quantity ÷ daily dose matches the duration | Drug-name pack and rules |
| Hazard flags | Error-prone notation, a look-alike pair, or a high-alert drug | ISMP and FDA lists |

- **Green:** the calibrated chance the value is correct is at least 0.995, and no hazard flag is set. One tap confirms. Handwritten drug names and high-alert drugs never reach Green (rules 8 and 16).
- **Amber:** the chance is between 0.90 and 0.995, or a hazard flag is set. The user compares the value with the ink crop, then picks or types it.
- **Red:** any one of these blocks scheduling:
  - the chance is below 0.90;
  - the value has no ink behind it;
  - two drug names look alike;
  - the strength is not listed for the drug;
  - the readers disagree on the drug.

  The block lasts until the user enters the value from the pharmacist or the label.

For each field type, the five signals feed a small logistic model fit on the labeled set (see Proof). The thresholds are set so that wrong values among Green fields stay at or below 0.5%, measured at the 95% upper bound. If no errors occur, proving that takes at least 600 Green fields per critical field type (3 ÷ 600 = 0.5%).

A model's own "I'm 90% sure" is never a signal, because it is not calibrated. A shown "94%" reads as permission. "Two readings disagree: metformin or metronidazole" tells the user what to check. Each state shows as an icon and a word as well as a colour, so it is clear without colour vision.

## Tech stack

Build one React Native app (Expo, TypeScript) for both phones, and write the safety logic once in a shared TypeScript core. The prototype's parser, matcher and rules are already the start of that core, in plain JavaScript. React Native draws the screens. The parts tied to the phone go through about five small native modules written in Swift and Kotlin: the alarms, the scanner, the text reader and the model runtime.

| Layer | iPhone | Android | Shared TypeScript core |
| --- | --- | --- | --- |
| App and UI | React Native with Expo (development builds), TypeScript. Requires iOS 26 or later, which covers 79% of iPhones in use (June 2026) | The same codebase. Requires Android 10 (API 29) or later | Screens, navigation and state, written once |
| Capture | VisionKit document camera, through a scanner module | ML Kit Document Scanner through the same module. It needs no camera permission and needs 1.7 GB of RAM | Blur and glare check |
| Reader A: printed text, ranked candidates | Apple Vision text recognition through a small native module. It gives up to 10 candidates per line, each with a confidence score, and takes drug names as custom words. Apple makes no handwriting claim | ML Kit Text Recognition v2 through a React Native binding. PP-OCRv5 mobile (Apache 2.0) handles handwriting, scoring 0.49 accuracy on handwritten English | Normalizer for abbreviations and units |
| Reader B: handwriting | Bundled open vision model (see Local models), run by llama.cpp through the llama.rn binding | The same model and weights | Line crops, prompts, test harness |
| Structurer | Same bundled model, with JSON output locked to a grammar. Apple Foundation Models is optional on Apple Intelligence phones through a native module once counsel clears it | Same bundled model, with JSON output locked to a grammar. Gemini Nano is not used in v1 because of its terms | The card schema and its allowed values |
| Label directions | Shared core | Shared core | Rules parser for printed label text such as "TAKE 1 TABLET BY MOUTH TWICE DAILY". Labels need no model |
| Model runtime | llama.cpp through llama.rn, or a thin native module if llama.rn lags llama.cpp's multimodal support. The Phase 0 bake-off decides | The same | One weights file and one grammar on both platforms, so test results carry over |
| Drug-name pack | SQLite with full-text search (FTS5) through op-sqlite or expo-sqlite | The same | Matcher weighted for handwriting confusions |
| Storage | SQLite with iOS Data Protection set to "until first unlock", so alarms and the dose screen work on a locked phone | SQLCipher-encrypted SQLite with a Keystore key. A native module copies times and discreet titles to device-protected storage for Direct Boot | Cards, card versions, dose log |
| Alarms | AlarmKit through a small Expo module in Swift, plus Expo Notifications (Time Sensitive) with the photo attached | AlarmManager.setAlarmClock(), a full-screen intent and BigPictureStyle notifications through a small Expo module in Kotlin | Dose times computed from FHIR Timing |
| Voice | expo-speech | expo-speech | Spoken versions of the card |
| Health data import (not in v1) | HealthKit Medications API (iOS 26), read-only, through a native module | Health Connect medical records: experimental and limited to one person, so skipped | RxNorm mapping |
| Model delivery | Apple-hosted Background Assets through a native module, or a signed download from a static bucket | Play for On-device AI packs (beta: up to 1.5 GB per pack), or the same bucket | Signed manifest and pinned versions |
| Crash reports | Xcode Organizer and MetricKit. No third-party SDK | Play Console vitals. No third-party SDK | Logs carry no card text, names or images |

The core is shared for safety. The 16 safety rules, the schedule engine, the normalizer, the matcher and the doubt score must behave the same on both phones. In TypeScript they are one set of files, tested once, and the same files run in the web prototype. The native modules stay thin: they pass images and times in and results out, and hold no safety logic. The library names above are candidates; Phase 0 checks each one's upkeep and support for React Native's New Architecture before adopting it.

Sources: [VisionKit scanner](https://developer.apple.com/documentation/visionkit/vndocumentcamerascan), [Vision candidates](<https://developer.apple.com/documentation/vision/recognizedtextobservation/topcandidates(_:)>), [Vision custom words](https://developer.apple.com/documentation/vision/recognizing-text-in-images), [iOS adoption](https://developer.apple.com/support/app-store/), [ML Kit Document Scanner](https://developers.google.com/ml-kit/vision/doc-scanner/android), [ML Kit Text Recognition v2](https://developers.google.com/ml-kit/vision/text-recognition/v2), [PP-OCRv5](http://www.paddleocr.ai/latest/en/version3.x/algorithm/PP-OCRv5/PP-OCRv5.html), [HealthKit Medications](https://developer.apple.com/videos/play/wwdc2025/321/), [Health Connect medical records](https://developer.android.com/health-and-fitness/health-connect/medical-records), [Apple-hosted asset packs](https://developer.apple.com/help/app-store-connect/reference/app-uploads/apple-hosted-asset-pack-size-limits), [Play for On-device AI](https://developer.android.com/google/play/on-device-ai).

## Local models

Ship your own open model rather than relying on the phone makers' built-in ones. Phones with 8 GB of RAM get a 2B vision model, Qwen3.5-2B or Qwen3-VL-2B (Apache 2.0). Phones with 6 GB get a 1B-class model. Both platforms run them through llama.cpp. The Phase 0 bake-off makes the final pick, because no model this small has published results on handwritten prescriptions.

**Why not the built-in models**

| Model | Why it is not the default |
| --- | --- |
| Apple Foundation Models | Accepts images only from iOS 27 and runs on at most about 43% of iPhones in use. It gives no confidence scores, and Apple's acceptable-use terms name medical as a high-risk domain. It stays an optional structurer on Apple Intelligence phones if counsel clears it |
| Gemini Nano | Its terms bar use "in clinical practice" or in any manner "overseen by" a medical-device regulator, and require users to be 18 or older. Structured output is still alpha, and it runs on only 68 phone models |
| Gemma 3n, MedGemma | Their prohibited-use terms list healthcare decisions, and MedGemma's terms must also be passed on to users |
| Qwen2.5-VL-3B | Non-commercial license |
| LFM2-VL | Free only below $10M annual revenue |

**Roles**

| Role | What runs | Note |
| --- | --- | --- |
| Reader A: ranked candidates | Apple Vision on iPhone; ML Kit plus PP-OCRv5 on Android | Gives a confidence score and up to 10 alternatives per line |
| Reader B: handwriting | The bundled vision model for the phone's tier | Reads each line crop on its own, never the whole page |
| Structurer | The same model in text mode, with output locked to the card grammar | Can emit only card fields and allowed values |
| Deciding the drug | No model | The drug-name pack proposes and the user decides |

**Bake-off shortlist**

| Model | Download (4-bit + vision part) | License | Evidence | Runtimes |
| --- | --- | --- | --- | --- |
| Qwen3.5-2B | 1.28 + up to 0.67 GB | Apache 2.0 | OCRBench 85.4%. On iPhone 17 Pro at 8-bit: 4.9 s to the first token for an image, with 4.64 GB peak memory | llama.cpp, MLX, LiteRT-LM, ExecuTorch |
| Qwen3-VL-2B | 1.11 + 0.45 GB | Apache 2.0 | OCRBench 85.8%. 43–49 tokens/s on Snapdragon 8 Elite Gen 5 | llama.cpp, MLX, ONNX |
| Gemma 4 E2B | 2.84 + 0.56 GB | Apache 2.0 | Document edit distance 0.290 (lower is better). 56.5 tokens/s for text on iPhone 17 Pro. Its 2.84 GB file is larger than one 1.5 GB Play AI pack | LiteRT-LM, llama.cpp, MLX |
| Qwen3.5-0.8B | 0.53 + up to 0.67 GB | Apache 2.0 | OCRBench 79.1% | llama.cpp, MLX, LiteRT-LM |
| GLM-OCR (0.9B) | 0.95 + 0.48 GB at 8-bit | MIT | 54.1% on the WildHandBench handwriting benchmark. 32.6% exact match on Bangladeshi prescription word crops, from a single blog test | llama.cpp, MLX |
| PaddleOCR-VL 1.6 (0.96B) | 0.94 + 0.88 GB at 16-bit | Apache 2.0 | 54.2% on WildHandBench. Ships at 16-bit because 4-bit broke its transcription | llama.cpp, LiteRT-LM |
| TrOCR-small handwritten (62M) | About 0.1 GB | The code repo is MIT; the model card has no license tag | 4.22% character error rate on IAM handwritten lines. Fine-tunes well on line crops | ONNX |

**What the evidence says**

- **Even frontier models struggle.** The best score 47–58% F1 on the medicine table of 200 handwritten Indian prescriptions (RxScribe Bench, September 2026). No model of 4B parameters or fewer was tested.
- **Small models trail humans on handwriting.** On the WildHandBench handwriting benchmark, the best model scores 71.85% against 77.09% for humans. OCR models of 1B parameters or fewer score 51–54%.
- **Most errors are plausible swaps.** 63–79% of handwriting errors come from the model's language prior: it writes a more likely word than the one on the page. In this app, that means a plausible but wrong drug name.
- **"As needed" is misread often.** In a Dutch study of handwritten medication lists, GPT-4o-family models misread "as needed" 35% of the time.

**What follows for the build**

- **Handwritten drug names are never Green (safety rule 16).** Two readers can share the same language habit and agree on the same wrong name.
- **Test the exact quantized file on phones.** 4-bit quantization broke PaddleOCR-VL's transcription.
- **Precompile the card grammar.** llama.cpp's iOS build leaves out the converter that turns a JSON schema into a grammar.
- **Pin model files to app versions.** If Apple Foundation Models is used, re-run the test set on every iOS release. Its model has changed three times since iOS 26.0.
- **Fine-tune the winner on the Phase 0 training split, which is split by writer.** The cheap fallback reader is TrOCR-small, fine-tuned on line crops.

**Device tiers**

| Phone RAM | Reader B | Structurer | What users see |
| --- | --- | --- | --- |
| 8 GB or more (every Apple Intelligence iPhone) | 2B vision model | Same model | Printed labels mostly Green; handwriting mostly Amber |
| 6 GB | GLM-OCR or Qwen3.5-0.8B | Qwen3.5-0.8B | More Amber |
| 4 GB or less | None | Rules only | Every handwritten field Amber or Red; labels still work |

**Runtime: llama.cpp (MIT) on both platforms.** Its iOS XCFramework includes multimodal support, and grammars are built in. On iPhone, the app requests Apple's increased-memory-limit entitlement. MLX Swift is the iPhone alternative if it runs faster in the bake-off. LiteRT-LM's Swift API is still an early preview, so it is Android-only for now.

Sources: [RxScribe Bench](https://arxiv.org/html/2609.13280), [WildHandBench](https://arxiv.org/html/2608.22959), [Dutch study](https://pmc.ncbi.nlm.nih.gov/articles/PMC13241658/), [Qwen3.5-2B](https://huggingface.co/Qwen/Qwen3.5-2B), [Qwen3.5-2B on iPhone](https://huggingface.co/litert-community/Qwen3.5-2B), [Qwen3-VL-2B](https://huggingface.co/Qwen/Qwen3-VL-2B-Instruct), [Qwen3-VL report](https://arxiv.org/pdf/2511.21631), [Qwen3-VL on Snapdragon](https://huggingface.co/qualcomm/Qwen3-VL-2B-Instruct), [Gemma 4 model card](https://ai.google.dev/gemma/docs/core/model_card_4), [Gemma 4 E2B on iPhone](https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm), [GLM-OCR](https://huggingface.co/zai-org/GLM-OCR), [prescription OCR blog test](https://dev.to/kaniel_outis/how-well-can-ocr-read-doctor-handwriting-in-2026-54hn), [PaddleOCR-VL 1.6](https://huggingface.co/PaddlePaddle/PaddleOCR-VL-1.6), [PaddleOCR-VL at 16-bit](https://huggingface.co/litert-community/PaddleOCR-VL-1.6), [TrOCR](https://github.com/microsoft/unilm/blob/master/trocr/README.md), [Qwen2.5-VL license](https://huggingface.co/Qwen/Qwen2.5-VL-3B-Instruct/blob/main/LICENSE), [LFM license](https://huggingface.co/LiquidAI/LFM2.5-VL-1.6B/resolve/main/LICENSE), [Gemma prohibited use](https://ai.google.dev/gemma/prohibited_use_policy), [HAI-DEF terms](https://developers.google.com/health-ai-developer-foundations/terms), [Foundation Models acceptable use](https://developer.apple.com/apple-intelligence/acceptable-use-requirements-for-the-foundation-models-framework/), [Foundation Models images](https://developer.apple.com/documentation/foundationmodels/attachment), [Foundation Models model versions](https://developer.apple.com/documentation/foundationmodels/systemlanguagemodel), [Apple Intelligence share](https://finance.yahoo.com/markets/stocks/articles/morgan-stanley-analyst-offers-apple-221700742.html), [ML Kit GenAI terms](https://developers.google.com/ml-kit/genai-terms), [ML Kit GenAI devices](https://developers.google.com/ml-kit/genai), [llama.cpp multimodal](https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md), [LiteRT-LM Swift](https://developers.google.com/edge/litert-lm/swift).

## Alarms and the photo

Neither platform shows a photo on the ringing alarm itself. On iPhone, the photo is one tap away on the dose screen. On Android, the dose screen with the photo can fill the screen if the user grants full-screen alerts.

|  | iPhone (iOS 26 and later) | Android (14 and later) |
| --- | --- | --- |
| Rings through silent mode | AlarmKit overrides Silent and Focus. It shows in StandBy and on a paired Apple Watch. If the user does not allow it, alarms never fire | setAlarmClock() fires through Doze. It needs the "Alarms & reminders" permission, which is off by default for new installs |
| Photo on the ringing alarm | No. The alert has a title, a stop control and one optional button | Yes, as a full-screen dose screen over the lock screen. Play grants this automatically only to calling and alarm apps; other apps must ask the user |
| Photo in a reminder | Yes. An image attachment up to 10 MB shows as a thumbnail in the banner, and a custom expanded view can show it larger | Yes. BigPictureStyle shows the photo when expanded and a thumbnail when collapsed |
| Breaks through Focus without an alarm | Time Sensitive notifications need no Apple approval, but they stay silent when the phone is muted. Critical Alerts need Apple approval; one medication app reported a refusal in May 2025 | A notification channel in the alarm category. Android 16's notification cooldown spares that category, but not reminders |
| Repeat rules | A time plus weekdays, or a single date. There is no "every 8 hours" rule | Any rule. The app sets each next occurrence itself |
| Limits | 64 pending notifications per app, and a repeating one counts once. AlarmKit has a cap, but Apple does not publish its size | A reboot clears all alarms. On Android 15, a force-stop cancels them until the app is reopened. Samsung can block background starts for apps unused for 3 days |

How the app uses these:

- **Two modes per card.** Each card is either an Alarm, which rings like a clock, or a Reminder, which is a notification. Scheduled doses default to Alarm. Refills and as-needed medicines get reminders.
- **iPhone scheduling.** Each dose time gets one AlarmKit alarm that repeats on chosen weekdays. "Every 8 hours" becomes one repeating alarm per clock time, such as 6:00, 14:00 and 22:00.
- **iPhone dose screen.** The alarm's button opens the dose screen through an App Intent.
- **iPhone fallback.** If the user refuses AlarmKit, cards fall back to Time Sensitive notifications with the photo attached.
- **AlarmKit cap.** Phase 0 measures the cap. The scheduler then chooses between repeating and one-off alarms for courses with a stop date.
- **Android permissions.** Onboarding asks for "Alarms & reminders" and for full-screen alerts, and says why. If either is refused, the card shows "Alarms may be late or small" and uses a high-priority notification with the photo.
- **Android rescheduling.** Alarms are reset after a reboot, after a time or time-zone change, and after an app update. They are also reset at unlock before first sign-in, from device-protected storage that holds only times and discreet titles.
- **Android alarm sound.** The sound uses the alarm audio usage, which Android 17 still allows from the background for apps holding the exact-alarm permission.
- **Android battery limits.** On Samsung, Xiaomi, OnePlus and Huawei phones, onboarding walks the user through exempting the app from battery limits.
- **The dose screen.** It shows the person's name in large type, then the drug, dose and instruction, the ink crop and the pill photo. Buttons are Taken, Skip and Snooze, and a speaker button reads the card aloud.
- **Lock-screen detail is set per card.** "Full" shows the person, drug and dose. "Discreet" shows only "Medicine for Rosa" and the time; the rest appears after unlock.

**Budget Android in the Philippines.** Transsion brands (TECNO, Infinix, itel) sold about a third of Philippine phones in 2025, followed by Xiaomi, Samsung, vivo and OPPO ([TelecomLead](https://telecomlead.com/smart-phone/philippines-smartphone-market-share-2025-transsion-dominates-budget-segment-as-xiaomi-samsung-vivo-and-oppo-battle-on-pricing-and-consumer-trust-124696)). [dontkillmyapp.com](https://dontkillmyapp.com/) rates Xiaomi and Samsung 5/5 for killing background apps, OPPO 4/5, and vivo, realme and TECNO 3/5. So the Android app adds three things:

- brand-specific setup screens for autostart and battery exemption;
- a missed-alarm check each time the app opens, which says plainly that an alarm did not fire;
- a weekly test alarm the user can run.

Sources: [AlarmKit alert](https://developer.apple.com/documentation/alarmkit/alarmpresentation/alert-swift.struct), [AlarmKit schedules](https://developer.apple.com/documentation/alarmkit/alarm/schedule-swift.enum), [AlarmKit overview](https://developer.apple.com/documentation/alarmkit/scheduling-an-alarm-with-alarmkit), [notification attachments](https://developer.apple.com/documentation/usernotifications/unnotificationattachment), [64-notification limit](https://developer.apple.com/forums/thread/811171), [Time Sensitive](https://developer.apple.com/videos/play/wwdc2021/10091/), [Critical Alerts refusal report](https://jhan.bearblog.dev/i-cant-understand-apples-critical-alert-policy/), [Android 14 exact alarms](https://developer.android.com/about/versions/14/changes/schedule-exact-alarms), [Play exact-alarm policy](https://support.google.com/googleplay/android-developer/answer/9888170), [Play full-screen policy](https://support.google.com/googleplay/android-developer/answer/13392821), [BigPictureStyle](https://developer.android.com/reference/android/app/Notification.BigPictureStyle), [Doze](https://developer.android.com/training/monitoring-device-state/doze-standby), [Direct Boot](https://developer.android.com/privacy-and-security/direct-boot), [Android 15 changes](https://developer.android.com/about/versions/15/behavior-changes-all), [Android 17 background audio](https://developer.android.com/about/versions/17/changes/bg-audio), [Samsung background limits](https://dontkillmyapp.com/samsung).

## Behind the app

Nothing behind the app holds patient data. The servers have three jobs: build the drug-name pack, package the model files, and give both to the app stores to deliver.

*Diagram: system boundary, servers vs. phone. See this section in `PRODUCT-SPEC.pdf`.*

The app checks for new packs without an account or a user ID. It verifies each file's signature before swapping it in.

| Piece | What it does | Running cost |
| --- | --- | --- |
| Content build job | Monthly: pulls RxNorm, applies the look-alike, Tall Man and abbreviation lists, then builds and signs the SQLite pack | CI minutes |
| Model packaging | Quantizes and signs the model files for each release | CI minutes |
| Signing key | Offline Ed25519 key. The public key is pinned in the app | None |
| Delivery | Apple-hosted Background Assets, included in the developer membership. Play for On-device AI packs. A static bucket as the backup | Close to zero |
| Billing | StoreKit 2 and Play Billing | Store commission: 15% under each store's small-business program, 30% standard |
| Website | Privacy policy, support pages, and a page explaining how the app reads, which App Review 1.4.1 expects | Static hosting |

Two things leave the phone without patient content, and both must be disclosed:

- **Store crash reports.** Logs are scrubbed so they carry no card text, names or images.
- **ML Kit telemetry.** On Android, ML Kit (the scanner and text reader) sends Google device and app details, identifiers and performance data. This goes in Play's Data safety form ([ML Kit disclosure](https://developers.google.com/ml-kit/android-data-disclosure)).

Caregiver sharing, planned for later, is the first feature that needs a server. Build it as an end-to-end encrypted relay that stores only ciphertext. It cannot be CloudKit, because App Review 5.1.3 bars storing personal health information in iCloud ([guidelines](https://developer.apple.com/app-store/review/guidelines/)).

## Data sources

Drug names are free and current. Interaction data and the published safety lists are not. RxNorm's prescribable subset has no license restrictions and updates monthly. Every interaction database we found is either non-commercial or priced only by private quote, and ISMP's lists need written permission for use in software.

| Source | Used for | Terms | Cost |
| --- | --- | --- | --- |
| [RxNorm Current Prescribable Content](https://www.nlm.nih.gov/research/umls/rxnorm/docs/prescribe.html) | The drug-name pack. As of Oct 5, 2026: 5,874 ingredients, 4,140 brands, 21,514 dispensable products, 239,059 NDCs | No licensing restrictions. Requires NLM attribution, and the app must ship current data or say it isn't current. Full release monthly, updates weekly | Free |
| [FDA Tall Man lettering list](https://www.fda.gov/drugs/medication-errors-related-cder-regulated-drug-products/fda-name-differentiation-project) | Look-alike display (rule 4). 23 entries covering 43 names, current Jun 12, 2026 | US government publication | Free |
| [ISMP Confused Drug Names](https://online.ecri.org/hubfs/ISMP/Resources/ISMP_ConfusedDrugNames.pdf) (2024) | Look-alike pairs (rule 4) | Software use needs ISMP's written permission. ISMP is now part of ECRI | Ask ECRI |
| [ISMP Error-Prone Abbreviations](https://www.ismp.org/system/files/resources/2024-04/ISMP_ErrorProneAbbreviation_List.pdf) (2024) | Notation rules (rule 5) | Internal, non-commercial use only. Any other use needs written permission | Ask ECRI |
| [ISMP high-alert list, community settings](https://home.ecri.org/blogs/ismp-resources/high-alert-medications-in-community-ambulatory-care-settings) (2021) | High-alert check (rule 8) | Written permission, as above | Ask ECRI |
| [openFDA drug labels](https://open.fda.gov/terms/) | Reference text only. 68,768 of 262,893 labels have a free-text interactions section, but no coded pairs | CC0 | Free |
| [DDInter 2.0](https://ddinter2.scbdd.com/terms/) | 302,516 interaction pairs | CC BY-NC-SA 4.0, non-commercial only | Not usable |
| [DrugBank](https://go.drugbank.com/releases/latest) | 1.41M interaction pairs (v6.0) | Full data CC BY-NC 4.0; commercial license by quote | Quote |
| [FDB](https://www.fdbhealth.com/solutions/medknowledge-drug-database), Medi-Span, Multum, Elsevier | Licensed interaction checking | Commercial; no public pricing or on-device terms | Quote |

What this means for v1:

- **Duplicate check, free.** The same-ingredient check (rule 10) and the strength check (rule 6) come from RxNorm alone.
- **Look-alike detection.** It starts from name similarity computed across RxNorm, plus the FDA Tall Man list. ISMP's pairs are added if ECRI grants permission.
- **Notation and high-alert rules are written in-house** and reviewed by the pharmacist advisor. ISMP's lists are referenced only if licensed, and counsel confirms this approach.
- **Interaction warnings wait for a commercial license (Phase 3).** Phase 0 asks FDB, Wolters Kluwer (Medi-Span), Oracle Health (Multum), Elsevier and DrugBank for quotes that include on-device use.
- **Build the pack from downloaded release files, never the live RxNav API.** NLM's RxNav site currently carries a lapse-in-funding notice. The interaction API it once offered was shut down on January 2, 2024 ([RxNav FAQ](https://lhncbc.nlm.nih.gov/RxNav/information/FAQs.html)).

**Philippines**

| Source | Used for | Terms | Cost |
| --- | --- | --- | --- |
| [Philippine National Formulary](https://pnf.doh.gov.ph) (8th edition, rolling updates) | Generic names, strengths and forms | Reuse terms not published; confirm with DOH | Free to read |
| [FDA Philippines product verification](https://verification.fda.gov.ph) | Registered brands mapped to generics, updated weekly | Bulk download and reuse terms not published; confirm with FDA | Free to read |
| [PH Core FHIR code system](https://build.fhir.org/ig/niccoreyes/ph-core/CodeSystem-PHFDACPRCS.html) | A ready-made code system built from FDA data | Check the guide's license | Free |

The Philippine pack is the Phase 0 data task. Until the DOH and FDA terms are confirmed, the pack is built for internal testing only.

## Privacy and regulation

FDA is unlikely to enforce its device rules on this app. Both medication reminders and patient-facing interaction reports are on FDA's enforcement-discretion list. The live risks are elsewhere:

- the model makers' terms;
- state health-data laws that may count processing on the phone as collection;
- App Store health rules.

This is a reading of public guidance, not legal advice. Counsel should confirm each row in Phase 0.

| Rule | What it says | What the app does |
| --- | --- | --- |
| [FDA device software policy](https://www.fda.gov/media/80958/download) (Sep 28, 2022) | Enforcement discretion covers apps that "keep track of medications and provide user-configured reminders" (Appendix B, #11). It also covers interaction reports for patients and caregivers (#18) | Never computes or recommends a dose. The reading only fills a list that the user confirms. Counsel confirms that reading a prescription still falls under #11 |
| [FDA CDS and General Wellness updates](https://www.fda.gov/regulatory-information/search-fda-guidance-documents/clinical-decision-support-software) (Jan 6, 2026) | CDS may now give a single recommendation when it is the only appropriate one. Patient-facing CDS is still not addressed | No change: the app makes no recommendations |
| [App Store 1.4.1, 1.4.2, 5.1.3](https://developer.apple.com/app-store/review/guidelines/) | Medical apps get extra scrutiny and must disclose methods and remind users to see a doctor. Dosage calculators need regulatory approval. No personal health information in iCloud, and no use of health data for advertising | Publishes a page on how the app reads. Copy says "ask your pharmacist." Does no dose math. Uses no CloudKit. Counsel decides whether to exclude the card store from device backups |
| [Google Play health policy](https://support.google.com/googleplay/android-developer/answer/9878878) | File the Health apps declaration ("Medication and Treatment Management"). If the app is not a regulated device, the store description must say it is "not a medical device" | Files the declaration and adds the statement. ML Kit's scanner needs no camera permission, which Play treats as health-sensitive |
| [FTC Health Breach Notification Rule](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0) (2024 amendments) | Covers health apps that can draw data from multiple sources. A breach includes unauthorized disclosure, such as sending data to an analytics SDK. Up to $53,088 per violation | Ships no third-party SDKs. A HealthKit import would add a second data source, which is one reason v1 leaves it out |
| [Washington My Health My Data Act](https://www.atg.wa.gov/protecting-washingtonians-personal-health-data-and-privacy) | Requires opt-in consent before collecting consumer health data. "Collect" includes processing "in any manner." Consumers can sue under the Consumer Protection Act | Asks for opt-in consent at onboarding anyway. Publishes a consumer health data privacy policy linked from the homepage |
| Nevada, Connecticut, Maryland | Similar consumer health-data laws. [Maryland](https://www.bakerdonelson.com/marylands-new-online-data-privacy-act-sweeping-protections-for-consumer-health-data-and-implications-for-health-care-life-sciences-and-ai) allows processing only when strictly necessary and bans selling | The same consent and policy cover these. The app never sells or shares data |
| Apple Foundation Models and Gemini Nano terms | Apple names medical as a high-risk domain. Google bars clinical use and any use "overseen by" a medical-device regulator | Neither is used by default (see Local models) |
| HIPAA | Applies to providers, insurers and their business associates, not to an app sold to consumers | Selling through pharmacies, insurers or clinics would change this (see Open decisions) |

Enforcement so far has targeted data shared with ad and analytics SDKs:

- [GoodRx](https://www.ftc.gov/news-events/news/press-releases/2023/02/ftc-enforcement-action-bar-goodrx-sharing-consumers-sensitive-health-info-advertising) paid $1.5M in 2023.
- [Premom](https://www.ftc.gov/news-events/news/press-releases/2023/05/ovulation-tracking-app-premom-will-be-barred-sharing-health-data-advertising-under-proposed-ftc) paid $100,000, plus $100,000 to three states.
- [BetterHelp](https://www.ftc.gov/news-events/news/press-releases/2023/07/ftc-gives-final-approval-order-banning-betterhelp-sharing-sensitive-health-data-advertising) paid $7.8M under the FTC Act.

An app with no SDKs and no server has little to disclose, and keeping it that way is the cheapest compliance there is.

**Philippines**

| Rule | What it says | What the app does |
| --- | --- | --- |
| [Data Privacy Act, RA 10173](https://lawphil.net/statutes/repacts/ra2012/ra_10173_2012.html) | Health data is sensitive personal information. Processing needs consent specific to the purpose, given beforehand. Unauthorized processing carries 3–6 years in prison and PHP 500k–4M fines. Breaches go to the NPC within 72 hours | Asks for purpose-specific consent at onboarding. Keeps all processing on the phone, which is the strongest position: the law excludes people handling their own household affairs, and a developer that never receives the data is unlikely to be a controller (no NPC opinion confirms this yet) |
| [NPC Circular 2022-04](https://insightplus.bakermckenzie.com/bm/data-technology/philippines-new-npc-circular-on-registration-of-data-protection-officers-and-data-processing-systems-takes-effect_1) | Registration is required for 250+ employees, sensitive data on 1,000+ people, likely risk, or automated decision-making | No registration while no data reaches the company. Analytics, crash logs with content, or cloud backup would change that |
| FDA Philippines, AO 2018-0002 | Software is a medical device if its intended use meets the device definition. Class A is notified; Classes B–D are registered | Intended use stays "transcription the user confirms, plus reminders." No dosing or interpretation claims. A Philippine regulatory lawyer confirms in Phase 0, including the status of FDA's medical device software circular |
| [Generics Act, RA 6675](https://www.chanrobles.com/republicactno6675.htm) and AO 62 s.1989 | Prescriptions must carry the generic name. Pharmacists must not fill "violative" prescriptions, such as one with no generic name | Matches on the generic name. Flags a missing generic name Red and points the user to the pharmacist |

## Proof

Launch waits on numbers measured on phones, not on a laptop. The number that matters most is how often a wrong value shows as Green.

**Test set (no real patient data)**

- 2,000 synthetic US prescriptions, handwritten by at least 60 writers on real prescription pads. At least 20 of the writers are clinicians. Each is photographed on at least 6 phone models in 3 lighting conditions, giving about 4,000 medicine lines.
- 500 pharmacy labels from at least 10 chains. They come from team members' own prescriptions, with consent.
- 300 printed prescriptions and discharge sheets.
- Planted traps: 200 look-alike pairs from the ISMP list, 200 error-prone notations and 100 unlisted strengths.
- Two people label every field independently, and a pharmacist settles disagreements.
- The set is split by writer: 60% to fit and calibrate, 40% held out.

**Launch gates**

| Metric | What it counts | Gate |
| --- | --- | --- |
| Confident-wrong | Wrong values among Green fields, per critical field type | ≤ 0.5% at the 95% upper bound |
| Values without ink | Shown values that do not trace back to a box on the photo | 0 |
| Look-alike catch | Planted look-alike pairs shown as a forced choice | 100% |
| Notation catch | Planted error-prone notations that trigger the spelled-out confirm | 100% |
| Planted-error catch | Wrong values that test users reject before confirming. At least 30 people, at least 10 of them aged 65 or older | ≥ 90% |
| Alarm delivery | Alarms that fire within 60 s of schedule, over a 14-day test on 20 devices with reboots and time-zone changes | ≥ 99.5% |
| Read time | Photo to draft card, 90th percentile, on the oldest supported phone | ≤ 10 s |
| Data leaving | Network requests that carry image or card data | 0 |

Coverage is the product metric: the share of critical fields on handwritten notes that reach Green. It is tracked but not gated, because a low number means more taps, not more risk.

The planted-error test matters most, because a user who rubber-stamps a pre-filled card defeats every other rule. If testers catch fewer than 90% of planted errors, add friction to the confirm screen until they do. One example is making users type the strength.

The test set will cost about $40k to $60k for writers, labelers and pharmacist time. This is an estimate, not a quote.

## Build plan

With 4 core people, the iPhone app ships about 22 weeks after kickoff and Android about 6 weeks after that, because both phones share one React Native codebase. Each phase ends at a gate.

*Diagram: roadmap, 4 phases and 3 gates. See this section in `PRODUCT-SPEC.pdf`.*

Gate A can change the product. If no reader combination proves itself on handwriting, v1 ships label-first, and handwriting reading returns when the models clear the gate.

**Team**

| Role | Weeks | Load |
| --- | --- | --- |
| React Native lead | 1–28 | Full time |
| React Native and native-modules engineer | 1–28 | Full time. Shared core and the Swift and Kotlin modules first, then Android hardening from week 23 |
| ML engineer: on-device models, test set, calibration | 1–28 | Full time |
| Product designer: accessibility, older adults | 1–22 | Full time |
| Backend and DevOps: content pipeline, signing, hosting | 4–12, then upkeep | About 2 person-months in total |
| Pharmacist advisor | 1–28 | About 4 hours a week |
| Privacy and FDA counsel, Philippines and US | 1–6, then before launch | Fixed engagement |
| Usability researcher | 16–22 | Contract |

**Budget to Android launch (estimate)**

| Item | Estimate |
| --- | --- |
| Engineering and design: about 27 person-months at $15k–$20k per loaded month | $405k–$540k |
| Test set: writers, labelers, pharmacist adjudication | $40k–$60k |
| Counsel: privacy, FDA position, app store review | $20k–$40k |
| Pharmacist advisor | $10k–$20k |
| About 20 test phones, weighted to TECNO, Infinix, Xiaomi, Samsung A-series, OPPO and vivo | $10k–$15k |
| Usability study, 30 or more participants | $10k–$20k |
| **Total** | **$495k–$695k** |

The budget excludes hosting (see Behind the app) and the license for an interaction database, which needs a vendor quote.

## Open decisions

Seven decisions shape the build. The market is settled: the Philippines first, the US second.

| Decision | Recommendation | Why | Status |
| --- | --- | --- | --- |
| Market | The Philippines first, iPhone first, with handwriting as the main input. Android follows at week 28. The US second, led by pharmacy labels | 86.5% of Philippine phones run Android ([StatCounter](https://gs.statcounter.com/os-market-share/mobile/philippines)). Prescriptions there are routinely handwritten; 28% of Filipino patients in one DOST-reported study could not read their doctor's writing. 94% of US prescriptions were electronic in 2021 ([Surescripts](https://surescripts.com/sites/default/files/legacy/docs/default-source/national-progress-reports/2021-national-progress-report.pdf)) | Decided |
| Handwriting in v1 | Decide at Gate A, on numbers measured on phones with Filipino doctors' handwriting | The best frontier models score 47–58% F1 on handwritten medicine tables | Open |
| Interaction warnings | Duplicate-ingredient check in v1. Get licensed quotes in Phase 0 | Every free interaction database is non-commercial | Open |
| Channel | Sell to consumers first | Selling through pharmacies, insurers or clinics puts data on a server and adds HIPAA (US) or controller duties under the Data Privacy Act (Philippines) | Open |
| Built-in AI models | Open models only in v1 | Apple's and Google's terms treat medical use as high-risk; Gemini Nano runs on 68 mostly flagship models | Open |
| HealthKit import | Leave out of v1 | It covers only the phone owner's list, not the people a caregiver manages | Open |
| Backups | Counsel decides. Either allow device backup, or exclude the card store and offer an encrypted export | App Store 5.1.3 bars personal health information in iCloud; a cloud backup the developer runs would make it a data controller in the Philippines | Open |

The closest competitors:

- [MedSheet](https://hunted.space/product/medsheet) is an AI prescription scanner and reminder app for Filipinos and OFWs, in English or Filipino. Where it processes images is not stated. It is the closest Philippine match.
- [Watsons Philippines](https://www.watsons.com.ph/shop-medicines-click-and-collect-express) and [GetMeds](https://apps.apple.com/us/app/getmeds/id1579162703) take prescription photos for a pharmacist to review on their servers.
- [SeriousMD](https://help.seriousmd.com/en/articles/1080179-introduction-to-seriousmd) issues e-prescriptions from 34,000+ doctors, stored on its servers.
- [Apple Health](https://support.apple.com/en-us/105064) scans US labels, sets reminders and checks interactions for the phone's owner.
- [RxScan](https://apps.apple.com/us/app/rxscan/id6778699478) (New Zealand, June 2026) reads labels on the phone, has users check each field, and sets reminders.
- [Samsung Health](https://news.samsung.com/us/samsung-health-app-update-makes-accessing-health-records-managing-medications-food-tracking-easier) scans bottles and checks interactions on Samsung phones.

No Philippine competitor found reads on the device. This app's advantage is five things they lack: on-device reading, handwriting, several people on one phone, ringing alarms with photos, and the check of the bottle label against the note.

## Sources

The facts in this spec were checked against public sources on Oct 9, 2026, and each section links the pages it relies on. The following could not be verified:

- **Handwriting accuracy on prescriptions** for any model with 4B parameters or fewer. The Phase 0 bake-off measures it.
- **Apple Vision's handwriting accuracy.** Apple makes no handwriting claim for its text-recognition APIs.
- **AlarmKit limits and review.** Its cap on the number of alarms is unknown, as is whether App Review accepts medication alarms. One medication app, [PillChime](https://hunted.space/product/pillchime), says it uses AlarmKit.
- **Play's treatment of a medication alarm app.** It is unclear whether Play grants such an app USE\_EXACT\_ALARM or automatic full-screen alerts. Play's policy names only alarm, timer, calendar and calling apps.
- **Photos on the Android lock screen.** It is unclear whether Android shows a notification's photo on a secure lock screen.
- **The current US share of non-electronic prescriptions.** The last published figure is 6%, from 2021, and not all of it is handwritten.
- **Interaction-database pricing and on-device terms.** No vendor publishes them.
- **Whether US health-data laws reach an on-device app.** Washington's law may or may not treat on-device processing as collection. The FTC rule may or may not cover an app whose data stays on the phone.
- **Whether the Gemma prohibited-use policy still binds Gemma 4**, which ships under plain Apache 2.0.
- **Where competitors' scans run.** It is unknown whether Samsung Health's bottle scan or Apple Health's label scan runs on the device.
- **The budget, timeline and test-set costs.** These are estimates, not quotes.

Philippines, not verified:

- **The share of Philippine prescriptions that are handwritten.** No DOH or PSA figure exists. The 28% unreadable figure comes from a DOST item seen only in a search snippet.
- **Whether a developer whose app never receives the data is a controller** under the Data Privacy Act. No NPC opinion was found.
- **The number, status and exclusions of FDA Philippines' medical device software circular.**
- **Reuse terms for the Philippine National Formulary and the FDA product list.**
- **Whether "OD" for once daily is standard Philippine usage.**
- **Phone RAM tiers by model** in the Philippine installed base.
