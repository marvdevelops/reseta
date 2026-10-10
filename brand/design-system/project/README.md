Reseta turns a paper prescription into reminders that say who takes what, how much and when. "Reseta" is the Filipino word for prescription. The people using it are adults caring for a parent, and older adults managing their own medicines, often on a budget Android phone, often without reading glasses. Every rule below comes from that.

**Tagline:** Read it right. Take it on time.

## The idea

A prescription is written in ballpoint ink on a white pad, and a careful pharmacist highlights what matters. Reseta's look comes from those three things:

- **Paper** (`paper`, `surface`): calm, light, plenty of room.
- **Ink** (`tinta`): the brand blue, the colour of a ballpoint pen. It marks what you can tap.
- **Highlighter** (`highlighter`): the yellow in the logo's check. It marks the one thing on a screen that needs a look. Use it once per screen at most.

The logo is an R whose leg is a check mark: the prescription (℞) and the person checking it. That check is the product. Reseta never decides for the user; it shows the paper and asks them to confirm.

## Voice and copy

Write like a kind pharmacist explaining something at the counter: short, plain, warm, never rushed.

- **Short sentences.** One idea each. Aim for words a 12-year-old knows.
- **Say "you" and name the person.** "Time for Lola Rosa's medicine", not "Dose due".
- **Everyday words, never system words.**

| Say | Don't say |
| --- | --- |
| medicine | medication, drug, Rx item |
| How much | Dose, quantity |
| How often | Frequency, sig |
| Check this | Amber, low confidence |
| Matches the paper | Confirm field, validate |
| Ask your pharmacist | Red, blocked, error |
| Reminder, alarm | Notification, trigger |
| the photo of your prescription | image, scan, input |

- **Buttons say what happens.** "Take photo", "Matches the paper", "I took it", "Remind me in 10 minutes". Never "OK", "Submit" or "Continue" alone.
- **Spell out abbreviations.** Show "once a day" next to OD, "twice a day" next to BID. When the paper says OD, ask: "Does OD mean once a day? It can also mean right eye."
- **Never give a safety verdict.** These words are banned in all copy: safe, OK to take, correct dose, approved, guaranteed. Say what to check and who to ask instead: "Ask your pharmacist which one."
- **Problems say what to do next.** "This strength is not in our list. Ask your pharmacist, then type it from the label." Never "Invalid strength".
- **No exclamation marks, no emoji, no jokes.** Sentence case everywhere. The product name is written "Reseta" in text and "reseta" only in the wordmark.
- **Filipino context.** Examples use Philippine names and honorifics (Lola Rosa, Tito Ben) and Philippine generics with the brand in brackets, as Philippine prescriptions do: "amlodipine (Norvasc)".

## Easy for older users

These are rules, not suggestions. They apply to every screen.

1. **One job per screen.** Each step has one instruction (`body-lg`) and one main button (`Button` primary, `target-primary` high). A second action is secondary or quiet, never a second blue button.
2. **Show where they are.** Multi-step flows open with `StepHeader`: "Step 2 of 4", a back button, and the step title. Never more than 5 steps.
3. **Big targets.** Nothing tappable is smaller than `target-min` (60px) in either direction. Leave `space-3` between targets.
4. **Big text that grows.** `body` (20px) is the default; nothing a user must read is below `caption` (17px). Layouts must survive the phone's largest text setting: stack side-by-side items, let screens scroll, never cut text off.
5. **Never colour alone.** Every state shows an icon and a word as well as a colour (`StateChip`).
6. **Confirm one thing at a time.** Medicine, strength, how much and how often are each confirmed on their own ("Matches the paper"). There is no "accept all".
7. **Nothing hidden.** No swipe-only actions, long-presses, hamburger menus or icon-only buttons. Every action is a labelled button on screen.
8. **Forgive.** Every destructive action asks once in words ("Delete Lola Rosa's amlodipine reminder?") and the undo is offered after.
9. **Read it aloud.** Cards and dose screens have a "Read aloud" button.

## Colour

Light is the main theme; dark follows the phone's setting. Set page backgrounds in `paper`, cards in `surface`, all body text in `ink` and helper text in `ink-muted`. Fill the primary button with `tinta` and put `on-tinta` text on it (never literal white: the dark tinta is light). Show a selected choice with a `tinta` border and `tinta-soft` fill.

The three review states have fixed meanings and fixed pairs:

| State | Word | Icon | Text on | Fill |
| --- | --- | --- | --- | --- |
| Looks right / Matches | Looks right (before the user confirms), Matches (after) | check | `ok` | `ok-soft` |
| Check this | Check this | ! in a circle | `check` | `check-soft` |
| Ask your pharmacist | Ask your pharmacist | ✕ in an octagon | `stop` | `stop-soft` |

`ok` is teal, not green, on purpose: green reads as "safe", which Reseta never says, and teal stays apart from `stop` for red–green colour-blind readers. Every text pair here is at least 5.3:1 in both themes, and body text at least 7:1.

Use `highlighter` for the logo's check, a `Notice` that needs a look, and the dark-theme focus ring. Put `on-highlighter` text on it. Never use it as text colour.

## Type

One family, chosen for low vision: **Atkinson Hyperlegible Next** (`sans`), from the Braille Institute, with distinct letter shapes so I, l and 1 never look alike. Numbers that matter (strengths, amounts, times) are set in **Atkinson Hyperlegible Mono** (`mono`) with the `dose` and `time` styles, so 1 mg never reads as l mg and 0.5 never loses its zero. Both are free on Google Fonts.

Use `title` once per screen, `heading` for card titles and the person's name, `body-lg` for the step instruction, `body` for everything else, `label` for field labels and chip words, `button` on every button, and `caption` only for attribution. Never go below 17px; never use weights under 400.

## Space, shape, depth

Screens have `space-4` side margins and `space-5` between cards. Cards pad `space-5`, round at `radius-lg` and sit on `paper` with `shadow-raise`. Buttons and choice tiles round at `radius-md`; chips and the step counter are pills (`radius-pill`). Buttons stay flat. A step's main button sits in a bar pinned to the bottom with `shadow-bar`, so it never scrolls away.

Focus: a 3px solid `focus-ring`, 2px outside the control, on every focusable element.

Motion is small and quick (150–200ms fades and slides); nothing bounces, and nothing moves at all when the phone's Reduce Motion is on.

## Logo

Use the **lockup** (`reseta-lockup.svg`, mark + wordmark) on the welcome screen, the website and the store listing. Use the **mark** alone (`reseta-mark.svg`) where space is tight: app icon, notification icon, favicon. On `tinta` or dark photos use `reseta-lockup-white.svg`. For one-colour print use `reseta-mark-ink.svg`.

- Keep clear space equal to the height of the wordmark's "e" on every side.
- Smallest sizes: mark 24px, lockup 120px wide.
- Don't recolour, rotate, outline, add shadows, or put the mark on yellow. Don't set "reseta" in another font; use the wordmark file.
- The tile's corner is 24 on a 100 grid; app stores mask the square icon (`reseta-app-icon.svg`) themselves.

## Iconography

Icons share the logo's stroke: a 2.25 stroke on a 24 grid, round caps and joins, no fills except the state shapes. They come from the `Icon` component (check, alert, stop, camera, clock, pill, person, speaker, back, plus). An icon always sits next to its word; there are no icon-only buttons. No emoji anywhere.

## Photos and illustration

The only photos are the user's own: the prescription, the line crops, and the pill or bottle. Show a crop at least 72px high in a `surface-sunk` well with `radius-sm`, never cropped tighter than the ink. No stock photos of smiling seniors, no illustrations of doctors.
