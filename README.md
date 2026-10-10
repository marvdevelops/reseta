<p align="center"><img src="brand/logo/png/icon.png" width="96" alt="Reseta logo"></p>

# Reseta

**Read it right. Take it on time.**

Reseta turns a paper prescription into medicine reminders, entirely on the phone. You scan the prescription, Reseta finds and reads each handwritten line with on-device AI, you check every line against the paper, and Reseta reminds you (or Lola, or Tito) at the right time with how much to take. *Reseta* is Filipino for "prescription".

Built for the AppBuildersPH Hackathon 2026: Local AI.

| | |
| --- | --- |
| **Team** | Marvin Fernandez (HighBeam Digital) |
| **Platform** | iPhone (iOS), built with Expo / React Native |
| **Repository** | https://github.com/marvdevelops/reseta |

---

## Why does Reseta benefit from running AI locally?

1. **A prescription is health data.** It names the patient, the doctor and the illness. Under the Philippine Data Privacy Act (RA 10173), health information is *sensitive personal information*. Reseta never sends the photo, the text or the schedule anywhere, so there is nothing to leak, sell or subpoena, and no server to trust.
2. **Medicine times can't depend on signal.** Reminders, reading a new prescription at the clinic, and checking what to take must work in a province with weak signal, on prepaid data that ran out, or during a brownout. After a one-time model download, Reseta works fully offline.
3. **Free to run, so free to use.** No per-scan cloud AI fees and no backend to pay for. That matters for families on a budget, who are most of the people managing medicines for an elderly parent.
4. **Two independent readers, both on the phone.** Apple Vision and a local vision-language model (Qwen3-VL 2B) read each line separately. When they disagree on the medicine or a number, Reseta asks the user to look at the paper. A misread drug name or dose is a medication error, so no reading is ever trusted without a person confirming it.

When the cloud disappears, Reseta still scans, reads, checks and reminds.

---

## What it does

1. **Scan.** The iPhone document scanner finds the paper's edges and flattens it. Photos picked from the library are straightened by Apple Vision the same way.
2. **Find the lines.** Apple Vision finds every line of writing and cuts each one out along its own slant. Reseta pre-selects the lines that look like medicine (drug name, strength, instructions) and leaves out the patient's name, the doctor and the date. You tap to add or remove lines.
3. **Read twice, on the phone.** Apple Vision reads each line (with the medicine list as hints and up to 12 ranked guesses). The local AI model reads the same line again. Disagreements are flagged.
4. **Check each line with the paper.** One field at a time: medicine, strength, how much, how often, for how long. Look-alike drugs (hydrOXYzine vs hydrALAZINE) force a choice. Error-prone shorthand such as OD (once a day, or right eye?) must be confirmed. Unlisted strengths and daily methotrexate block saving. Nothing becomes a reminder until every critical field is confirmed.
5. **Remind.** Big, plain reminders: "8:00 AM · Take 1 tablet, after meals · Amlodipine 5 mg", with the pill photo, "I took it", "Remind me in 10 minutes" and "Read aloud".

Designed for adults up to the elderly: large type (Lexend, 20 pt body, 17 pt minimum), 60 pt touch targets, one task per screen, a 12-hour clock with Earlier/Later buttons instead of typing, plain words ("How often", not "Frequency"), and never colour alone.

---

## What runs locally (on the phone, offline)

| Task | How |
| --- | --- |
| Document scanning and perspective correction | VisionKit document camera; `VNDetectDocumentSegmentationRequest` + Core Image `CIPerspectiveCorrection` |
| Finding each line of writing, cut along its slant | Apple Vision `VNRecognizeTextRequest` (accurate) + `CIPerspectiveCorrection` per line |
| Reading each line (reader 1) | Apple Vision text recognition, two passes (raw, and with medicine names as custom words), top-10 candidates |
| Reading each line again (reader 2) | **Qwen3-VL-2B-Instruct** (Q4_K_M GGUF + Q8 mmproj) running in **llama.cpp** via `llama.rn`, on the phone's GPU |
| Picking the best reading, matching the drug | Handwriting-aware edit distance against a bundled drug list (Philippine sample list, or 3,332 US generics from RxNorm) |
| Understanding the instructions | Rules for prescription shorthand (OD, BID, TID, q8h, PRN, #30, x 30 days); no model ever decides the drug or the dose |
| Safety checks | Rules in a shared TypeScript core: look-alike names, unlisted strengths, error-prone notation, high-alert drugs, duplicate ingredients, readers disagreeing (57 automated tests) |
| Schedule and reminders | Times from each person's wake and sleep times; iOS local notifications |
| Storage | On-device storage only; no accounts, no sync, no analytics |

## What requires internet

| What | When | What is sent |
| --- | --- | --- |
| Downloading the AI model (1.55 GB) from Hugging Face | Once, when the user turns on the AI reader | Nothing about the user. A plain file download, in parallel resumable pieces |
| Installing the app and app updates (Expo EAS Update) | On install; the app checks for a newer version when opened, and installs only when the user taps **Update now** | Nothing about the user's medicines or photos |

Everything else, including scanning, reading, AI, checking and reminders, works in airplane mode.

---

## Disclosures

### Models used

| Model | Use | Licence | Runs |
| --- | --- | --- | --- |
| Apple Vision text recognition (built into iOS) | Reader 1, line detection | Apple platform | On device |
| Apple Vision document segmentation, VisionKit document camera | Finding and flattening the paper | Apple platform | On device |
| Qwen3-VL-2B-Instruct, Q4_K_M + mmproj Q8_0 GGUF (Alibaba Cloud / Qwen) | Reader 2 (second opinion on handwriting) | Apache 2.0 | On device, via llama.cpp |
| Tesseract.js | Reader in the web build only (not the iPhone app) | Apache 2.0 | In the browser |

No cloud AI model is used at runtime.

### Technologies and frameworks

- Expo SDK 57, React Native 0.86, TypeScript
- Swift native module (`rx-app/modules/reseta-vision`): Vision, VisionKit, Core Image
- llama.cpp via [llama.rn](https://github.com/mybigday/llama.rn) 0.12.9
- expo-notifications, expo-calendar, expo-image-picker, expo-image-manipulator, expo-file-system, expo-speech, expo-updates, expo-font, react-native-svg, AsyncStorage
- Vitest (57 tests on the safety core)
- Python 3 standard library (RxNorm drug-list builder)
- Lexend typeface (SIL Open Font License)

### APIs and cloud services

- **Hugging Face**: hosts the Qwen3-VL GGUF files; downloaded once by the app
- **Expo Application Services (EAS Build, EAS Update)**: builds the iOS app and delivers app updates; no user data passes through it
- **NLM RxNorm** (release 2026-10-05) and the **FDA Tall Man lettering list**: downloaded at development time to build the bundled US drug list; not called by the app
- No backend, no database server, no analytics or crash-reporting SDKs

### Existing code and assets

- Reseta builds on our earlier **Rx Reader** prototype: the TypeScript safety core (sig parser, drug matcher, strength check, blockers, first 40 tests), the RxNorm pack builder and the product spec in `docs/`.
- New in this hackathon: the Reseta brand and design system, the redesigned elder-friendly app, the Apple Vision native module (scanning, straightening, line detection, two-pass reading), the local AI second reader (Qwen3-VL via llama.cpp) with parallel resumable model download, reader-agreement checks, over-the-air updates, and the plain-language rewrite.
- Third-party data and assets: RxNorm Current Prescribable Content from the U.S. National Library of Medicine; FDA Tall Man lettering list (U.S. government work); Lexend font (OFL); Qwen3-VL weights (Apache 2.0); Expo blank TypeScript template.
- `samples/sample-prescription-synthetic.jpg` is generated (typeset in a handwriting font). It is not a real prescription and "Rosa Cruz" is not a real patient.

### AI development tools

- **Claude Code** (Anthropic, Claude Opus) was used to write and refactor code, design the logo and brand, write the copy, research models and licences, and debug builds.

---

## Run it

Requires Node 22+, Xcode 16+ for native builds, and an Expo account for EAS.

```bash
cd rx-app
npm install
npm test              # 57 safety tests
npx tsc --noEmit      # type check
npx expo start --web  # quick look in a browser (Tesseract reader, no local AI)
```

The iPhone app needs a development or preview build, because of the native Vision module and llama.cpp:

```bash
cd rx-app
eas build --platform ios --profile preview
```

Then in the app: **More → AI reader → Turn on the AI reader** to download the model once.

Rebuild the US drug list from a newer RxNorm release:

```bash
cd 03-rxnorm-licensing/pack
python3 build_rxnorm_pack.py ../RxNorm_full_prescribe_10052026 out/ ../../fda_tall_man_lettering_2026-06-12.csv
cp out/rxnorm-us-2026-10-05.app.json ../../rx-app/assets/packs/
```

## Repository layout

| Path | What |
| --- | --- |
| `rx-app/` | The Reseta iPhone app (Expo, TypeScript) |
| `rx-app/src/core/` | Safety core: parser, matcher, strength check, reader comparison, blockers, tests |
| `rx-app/src/ui/` | Screens and the UI kit |
| `rx-app/src/platform/` | Vision, scanner, local AI, notifications, files |
| `rx-app/modules/reseta-vision/` | Swift native module (Apple Vision, VisionKit) |
| `brand/` | Logo files and the design system source |
| `03-rxnorm-licensing/pack/` | RxNorm drug-list builder |
| `docs/` | Product spec |
| `samples/` | Synthetic sample prescription |

## Safety note

Reseta is a reading and reminder aid. It does not diagnose, recommend or change any dose, and it never says a medicine is "safe". Every reading is confirmed by a person against the paper, and anything unclear sends the user to their pharmacist.

*Drug names in the US list come from the RxNorm release of 2026-10-05. This product uses publicly available data courtesy of the U.S. National Library of Medicine (NLM), National Institutes of Health, Department of Health and Human Services; NLM is not responsible for the product and does not endorse or recommend this or any other product.*
