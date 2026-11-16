# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Neyen** ("the art of breathing"): a guided breathwork timer, built as a static, framework-free PWA in vanilla JS. It is deployed to Netlify at https://neyenbreath.netlify.app. The UI is bilingual (Spanish and English). The language is detected from the browser, can be switched from the top-right button, and is remembered. It is mobile-first and runs in portrait orientation.

The techniques modal asks "what do you need?" and lists each technique under its goal (calm, sleep, focus, energy). The user taps the breathing circle to start a session. A short check-in asks how they feel (1–5, can be skipped or turned off), then a 3-2-1 countdown runs. Then the circle expands and contracts through each phase (inhale, hold full, exhale, hold empty).

The technique audio is made of layers that play in sync:

- phase cues (always on)
- the breathing sound
- a voice guide (first N cycles by default)
- second ticks, generated in code

Ambient music plays separately. Each sound can be turned on or off, and its volume adjusted, from a quick row of buttons or from the 🎚️ sound panel.

Sessions end manually or at a limit: the duration pill (∞/3/5/10/15 min), or a technique's own cycle limit. Sessions of 30 s or more are recorded in localStorage, and they feed the day streak and the history modal. A summary with the same "how do you feel?" question follows each session, so the history can show how often people end up better than they started.

The history modal ("Your practice") also opens:

- **Breathing tests** (also from the 🫁 corner button): BOLT control pause and slow exhale, timed, with results kept on the device.
- **Daily reminder**: a recurring event in the user's calendar (Google Calendar link or an `.ics` file). There is no push: the app has no server.

## Commands

```bash
npm install
npm run build          # node build.js → ./dist (gitignored)
npm test               # unit tests (node --test), see test/
npm run format         # prettier --write .
npm run format:check
```

- **No dev server script.** Serve the repo root over **http**, for example with VS Code Live Server or `npx serve .`.
  - Asset paths are absolute (`/assets/...`), so the server root must be the repo root.
  - On `file://`, `fetch` fails, so no audio plays.
- **Production output:** serve `./dist`. The service worker only exists there.
- **`SITE_URL` env var** (default `https://neyenbreath.netlify.app`) replaces the `https://TU-DOMINIO.com` placeholder at build time. `index.html` already hardcodes the real URL, so this is effectively a no-op.

## Layout

```
index.html          single page; loads /assets/js/main.js and tutorial.js as modules
style.css           all app styles (design tokens at :root)
tutorial.js         standalone IIFE onboarding overlay (injects its own CSS, canvas spotlight)
manifest.json       PWA manifest
build.js            build pipeline + service-worker generator
assets/js/          ES modules (app logic); has its own package.json {"type":"module"} for Node tests
assets/sounds/      background-music.mp3 + one folder per technique (<dir>/<dir>-{breathing,breaths,voice-es,voice-en}.mp3)
assets/icons/       PWA icons + og-image.jpg (link preview, 800×800 square for WhatsApp's small thumbnail)
design/             og-image.html: source of og-image.jpg (render steps inside); not built
test/               unit tests + setup (audio mock, localStorage shim)
dist/               build output (gitignored; emptied and rebuilt on every build)
```

### JS modules (`assets/js/`)

`main.js` is the entry point and the only module that imports everything. It wires the modules together and holds the app state: `activePreset`, the chosen duration, and which preset the running session uses.

| Module                | Responsibility                                                                                                                                                                                                                                                                       |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `presets.js`          | `PRESETS`: names/descs (Es/En), `goal`, `timing` `[inhale, holdFull, exhale, holdEmpty]` in seconds (fractions allowed), `soundDir`, `helperCycles`, optional `autoLimitCycles`, optional `warnEs`/`warnEn` safety note. `GOALS` (order, emoji, i18n label) for the techniques modal |
| `i18n.js`             | `i18n.es` / `i18n.en` string tables. Some entries are functions. Every key must exist in both languages (enforced by `test/content.test.mjs`)                                                                                                                                        |
| `ui.js`               | DOM helpers: `lang` (exported `let`; saved → browser → English), `applyLang`, `presetText(preset, field)`, limits + duration pill/badge, modals (focus management), toast (optional action button), preset cards                                                                     |
| `session.js`          | Session state and timing: countdown, phases, counters, limit checks, wake lock, keep-alive oscillator, audio fade-out on stop. Emits `onSession('starting' \| 'start' \| 'end', fn)`                                                                                                 |
| `loop.js`             | Layered technique audio: loads/decodes the active preset's layers, schedules every layer each cycle on the audio clock, per-layer gain (`setLayerEnabled`, `setLayerVolume`), `stopLoop(fade)`. Voice-guide rules live here                                                          |
| `sound-controls.js`   | Quick sound buttons + the 🎚️ panel. Per-channel `{ on, vol }` saved as `neyen.sound`; migrates older boolean prefs                                                                                                                                                                   |
| `audio.js`            | Shared `audioCtx`, synthesized UI sounds (`setUiSounds` toggles hover/click/select sounds; session cues are always on), `ambient` music player with its **own AudioContext** (`setMuted`, `setVolume`, both safe before it starts)                                                   |
| `history.js`          | Practice history in localStorage (`neyen.history`): `addSession` (with `moodBefore`), `setMoodAfter`, `getStats` (streak, totals, recent, `compared`/`improved`). Sessions < `MIN_RECORDED_SECS` (30) aren't recorded                                                                |
| `practice.js`         | Streak stat, check-in before the session (`startWithCheckIn`), end-of-session summary + mood question (1–5 scale), "Your practice" history modal and its shortcuts                                                                                                                   |
| `breath-test-data.js` | Breathing test definitions (`TESTS`, Es/En fields like presets, score `bands`), `bandIndex`, results in `neyen.tests`. No DOM                                                                                                                                                        |
| `breath-tests.js`     | Breathing tests modal: list → instructions + results → timer → result                                                                                                                                                                                                                |
| `reminder-ics.js`     | Daily reminder as a calendar event: `REMINDER_SLOTS` (every 30 min), `buildIcs`, `icsPath`, `googleCalendarUrl`. No DOM; also used by `build.js`                                                                                                                                     |
| `reminder.js`         | Reminder modal (time select + Google / `.ics` links), `neyen.reminder`. Falls back to a generated blob when the static `.ics` files aren't there (repo root)                                                                                                                         |
| `media-session.js`    | Lock-screen controls (Media Session API) with a silent looped `<audio>`; best effort                                                                                                                                                                                                 |
| `storage.js`          | `load(key, fallback)` / `save(key, value)`: JSON + try/catch, keys prefixed `neyen.`                                                                                                                                                                                                 |
| `interactions.js`     | Hover/click sounds, haptics, keyboard shortcuts (Space = start/stop, Esc = close modals). Never owns session state                                                                                                                                                                   |

localStorage keys:

- `neyen.lang`
- `neyen.sound`
- `neyen.duration`
- `neyen.history`
- `neyen.warningsSeen`
- `neyen.checkIn` (ask before starting; default on)
- `neyen.tests` (breathing test results)
- `neyen.reminder` (`{ time }` of the last reminder added), `neyen.reminderOffers` (times the post-session toast offered it, max 3)
- `neyen.tutorialDone` (written by `tutorial.js`, plain string)

## Key conventions & gotchas

- **Timing strategy: `audioCtx.currentTime` is the single master clock.**
  - `session.js` anchors `_t0` (the moment the first inhale starts, right after the countdown).
  - Every countdown step, phase end and session tick is an _absolute_ deadline counted from `_t0`. `setTimeout` (via `_at()`) is only used to wake up near each deadline, so timer jitter never adds up.
  - `loop.js` schedules every layer of every cycle as a one-shot source at `t0 + n·cycleDur`, with a look-ahead scheduler (3 s). It never uses native `loop`: file lengths can differ from the cycle by a few ms and would drift. Each source is trimmed to its cycle slot.
  - `startTimer` awaits `loopsReady()` (capped at 4 s) before anchoring.
  - `requestAnimationFrame` is used **only** for the cosmetic countdown number.
- **Layers are always scheduled.** Toggling or volume only changes the layer's gain, so changes are instant and never re-sync. To add a channel, add it to:
  - `LAYER_VOLUME` / `_enabled` / `_volume` in `loop.js`
  - `CHANNELS` + `DEFAULT_ON` in `sound-controls.js`
  - a `.sound-toggle` button in `index.html` (optional)
  - the i18n keys
- **Voice rules:** the voice plays for the first `helperCycles` cycles. If the user turns it on _after_ those cycles, it stays on for the rest of the session, starting mid-cycle (`voiceKeep`).
- **`TRANSITION_MS = 1200`** (in `session.js`) must match the CSS `--transition` (1.2s). `isTransitioning()` blocks start/stop during this window.
- **Session events:** `'starting'` fires synchronously inside the user's tap, before any `await`. Things that need a user gesture on iOS (`media-session.js`'s `<audio>.play()`) hook there.
- **Avoiding circular imports:** `session.js` reads limit state through `registerLimitGetter()`.
- **`window.applyLang`** (= `setLanguage` in `main.js`) and **`window.showTutorial`** (from `tutorial.js`) connect the bundled modules with the standalone tutorial. `build.js` minifies `tutorial.js` with `toplevel: false`.
- **Language** is applied at module load in `main.js`, before `tutorial.js` renders, so the tutorial opens in the right language.
- **Mobile audio:** the ambient `AudioContext` must be created synchronously inside a user gesture, with no `await` before `new AudioContext()`. The sound buttons don't `stopPropagation`, so a first tap on them still reaches the document listener that starts the music.
- **Dialogs** (`.modal-overlay`):
  - each has `role="dialog"` and an `aria-labelledby` pointing at `<id>-title`;
  - closed ones are `visibility: hidden`, so they leave the Tab order;
  - `openModal`/`closeModal` move focus in and back.
- **Icon-only buttons** get a translated `aria-label`/`title` via `data-i18n-label="key"`.
- **Safety notes:** presets with `warnEs`/`warnEn` show the note on their card and a one-time "Before you start" modal. If that modal appears mid-session, the session stops and does not restart.
- **Copy:** UI copy uses Rioplatense voseo ("Tocalo", "respirás"), and code comments are mostly English. Match the surrounding style.

## Adding things

- **New technique:**
  1. Add an entry to `PRESETS` with `soundDir: '<dir>'`.
  2. Add `assets/sounds/<dir>/` with `<dir>-breathing.mp3` (phase cues), `<dir>-breaths.mp3`, `<dir>-voice-es.mp3` and `<dir>-voice-en.mp3`. Every file must be **exactly one cycle long** (the sum of `timing`) and start at the beginning of the inhale. `soundDir` is also the id stored in the history, so don't rename it later.
  3. Add `warnEs`/`warnEn` if the technique needs a caution.
  4. Consider updating the tutorial's "when and how" step.
- **New language:**
  1. Add an `i18n` table with every key.
  2. Add `nameXx`/`tagXx`/`descXx`/`warnXx` to each preset (`presetText()` picks the suffix).
  3. Add `<dir>-voice-xx.mp3` per technique.
  4. Extend the language button (it currently toggles `es` ↔ `en`) and the tutorial steps.
- **New UI string:** add it to both `i18n.es` and `i18n.en`, then use `data-i18n="key"` (text) or `data-i18n-label="key"` (aria-label + title).

## Tests (`test/`)

`npm test` runs `node --test` with `test/setup.mjs`, which:

- swaps `./audio.js` for `test/mock-audio.mjs` (a mock AudioContext with a settable `currentTime` that logs every scheduled source);
- provides an in-memory `localStorage`.

The test files:

- `loop.test.mjs`: the scheduler (cycle alignment, voice rules, ticks, gains, fade-out, fractional cycles)
- `history.test.mjs`: streak, stats, mood before/after
- `content.test.mjs`: i18n keys vs `index.html`, preset completeness, sound files on disk, every goal has a technique, breathing test definitions
- `reminder-and-tests.test.mjs`: `.ics` content, Google Calendar link dates, test score bands and results storage

There are no browser tests in the repo. Check UI changes by running the app.

## Build pipeline (`build.js`)

It empties `dist/` (rather than deleting it: on Windows the folder can't be removed while something has it open), then:

1. Minifies `style.css` with clean-css (level 2).
2. Bundles `assets/js/main.js` with **esbuild** into a single minified IIFE and drops `console.*`.
3. Minifies `tutorial.js` with terser and drops console calls.
4. Rewrites and minifies `index.html`: module script tags become `defer`. It throws if the expected `<script type="module" src="/assets/js/main.js">` tag is missing. It also injects the service worker registration.
5. Copies `assets/` (except `js/`) and `manifest.json`.
6. Writes the daily reminder files, `dist/reminder/<lang>/<HHMM>.ics` (one per half hour and language, from `reminder-ics.js`), and a `dist/_headers` that serves them as `text/calendar`. A real https URL is what makes iOS show "Add to Calendar".
7. Generates `dist/sw.js`:

   - Everything is **precached at install**, sounds included (~1.5 MB), so the app works fully offline from the first visit.
   - There are two caches named after a content hash: `neyen-shell-<hash>` and `neyen-sounds-<hash>`. A deploy only re-downloads what changed, and old caches are deleted on activate.
   - All requests are cache-first. Navigations are served the cached `/index.html`, except `/reminder/*`, which goes to the network.
   - A new version activates immediately. `main.js` then shows a "new version · Reload" toast, delayed until the session ends if one is running.

   `sw.js` is generated by the build. Never hand-edit it; change `generateServiceWorker()` instead.
