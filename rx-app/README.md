# Rx Reader (React Native prototype)

Reads a prescription photo on the phone, makes the user confirm every field against the ink,
then sets dose alarms. Nothing is sent to a server. Philippines first, iPhone first.

## Run it

Requires Node 22+.

```bash
npm install
npm test            # 40 safety tests on the shared core, including the US list
npx expo start      # scan the QR code with Expo Go on a phone
npx expo start --web
```

## What runs where

| | Web | Expo Go (phone) | Development build (planned) |
|---|---|---|---|
| Line reading | Tesseract.js in the browser | Type each line beside its crop | Apple Vision (iOS), ML Kit (Android) via a native module |
| Alarms | Dose screen while the page is open, plus a calendar file | Daily local notifications, and events with alerts written into the phone calendar | AlarmKit (iOS), AlarmManager.setAlarmClock + full-screen intent (Android) |
| Test-data export | Downloads a JSON file | Share sheet | Share sheet |

## Layout

- `src/core/` — the shared safety core (TypeScript, no React): drug list, matcher, sig parser,
  doubt states and blockers, sample and calendar formats. `core.test.ts` covers the safety rules.
- `src/platform/` — phone-specific pieces, each with a `.web.ts` twin: reader, crop, alarms, files.
- `src/ui/` — screens.
- `App.tsx` — tabs, storage, the in-app dose ticker, notification taps.

Two drug lists, chosen on the Scan screen:

- **Philippines (sample), the default:** about 85 common generics and brands in `src/core/drugs.ts`.
- **United States (RxNorm):** `assets/packs/rxnorm-us-2026-10-05.app.json`, built by
  `03-rxnorm-licensing/pack/`. 3,332 generics, with FDA Tall Man look-alike pairs. A confirmed
  card stores its RxCUI when exactly one product matches the drug and strength. The screen shows
  NLM's attribution and the release date whenever this list is in use, as NLM's terms require.

`src/core/druglist.ts` holds both lists and the high-alert rule for each.

## Sending an update to installed phones (EAS Update)

Standalone builds (`eas build --profile preview`) ask Expo's update server for a newer version when Reseta opens
and when it comes back to the screen. Nothing installs on its own: a yellow "A new version of Reseta is ready"
notice appears on Today, and the update installs only when the user taps **Update now**. More → App version shows
what is installed and has a "Check for updates" button.

To publish a change to everyone on the preview channel:

```bash
npm run update:preview -- --environment preview --message "What changed, in plain words"
```

Updates carry only JavaScript and images. `runtimeVersion` uses the **fingerprint** policy, so an update reaches
only builds with the same native code. If you change native code (the `modules/reseta-vision` Swift, a new
native package, or `app.json` plugins and permissions), make a new build instead: `eas build -p ios --profile preview`.
