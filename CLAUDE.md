# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Neyen** ("the art of breathing"): a guided breathwork timer, built as a static, framework-free PWA in vanilla JS. It is deployed to Netlify at https://neyenbreath.netlify.app. The UI is bilingual (Spanish is the default, plus English). It is mobile-first and runs in portrait orientation.

The user taps the breathing circle to start or stop a session. The circle expands and contracts through each phase (inhale, hold full, exhale, hold empty). The technique audio is made of layers that play in sync: phase cues (always on), the breathing sound, a voice guide (first N cycles by default), and generated second ticks. Ambient background music plays separately. The user can turn music, voice, breathing sound, and ticks on or off at any time, including during a session, and their choices are saved in localStorage.

## Commands

```bash
npm install
npm run build        # node build.js → produces ./dist (gitignored)
```

- There are no tests (`npm test` is the npm placeholder) and no linter config.
- There is no dev server script. Serve the repo root over **http** to develop, for example `npx serve .` or VS Code Live Server. Asset paths are absolute (`/assets/...`), so the server root must be the repo root. On `file://`, `fetch` fails, so no technique audio or music plays.
- To check production output, serve `./dist`. The service worker is only generated there.
- `SITE_URL` env var (default `https://neyenbreath.netlify.app`) replaces the `https://TU-DOMINIO.com` placeholder in the HTML at build time. The current `index.html` already hardcodes the real URL, so this step is effectively a no-op.

## Layout

```
index.html          single page; loads /assets/js/main.js and tutorial.js as modules
style.css           all app styles (CSS custom properties at :root)
tutorial.js         standalone IIFE onboarding overlay (injects its own CSS, canvas spotlight)
manifest.json       PWA manifest
build.js            build pipeline + service-worker generator
assets/js/          ES modules (source of truth for app logic)
assets/sounds/      background-music.mp3 + one folder per technique (<dir>/<dir>-{breathing,breaths,voice-es,voice-en}.mp3)
assets/icons/       PWA icons + og-image
dist/               build output (gitignored; wiped and rebuilt on every build)
```

### JS modules (`assets/js/`)

`main.js` is the entry point and the only module that imports everything. It wires the modules together and holds the active technique state (`activeTechniqueName`, `times`).

| Module | Responsibility |
|---|---|
| `presets.js` | `PRESETS` array: names, tags, and descriptions (Es/En); `timing: [inhale, holdFull, exhale, holdEmpty]` in seconds; `soundDir` (folder under `assets/sounds/`); `helperCycles` (cycles the voice guides by default); optional `autoLimitCycles` |
| `i18n.js` | `i18n.es` / `i18n.en` string tables. Some entries are functions for dynamic strings. Every key must exist in both languages |
| `ui.js` | DOM-only concerns: `lang` (exported `let`), `applyLang`, technique label, session limits (`limitType`/`limitValue`/`checkLimit`), modals, toast, preset card rendering, `formatTime`, `setCircleState` |
| `session.js` | Session state machine and timing: start/stop, phase cycle, counters, wake lock, a silent keep-alive oscillator (prevents Bluetooth audio dropouts) |
| `loop.js` | Layered technique audio: loads and decodes the layers for the active preset and language, and schedules them every cycle. Each layer has its own GainNode; `setLayerEnabled()` fades a layer in or out. Ticks are generated in code. Voice rules: it plays for the first `helperCycles` cycles; turning it on manually after that keeps it on for the rest of the session |
| `sound-controls.js` | The `.sound-toggle[data-sound]` buttons (music, voice, breaths, ticks): applies and saves preferences (localStorage key `neyen.sound`) and calls `ambient.setMuted()` or `setLayerEnabled()` |
| `audio.js` | Shared `audioCtx` plus synthesized UI sounds (tones, clicks, chimes). Also `ambient`, the background music player, which has its **own separate AudioContext** so it can be suspended independently. `ambient.setMuted()` is safe to call before the music has started |
| `interactions.js` | Hover/click sounds, haptics, and keyboard shortcuts (Space = start/stop, Esc = close modals). Never owns session state; it calls callbacks |

## Key conventions & gotchas

- **Timing strategy:** `audioCtx.currentTime` is the single master clock. At session start, `session.js` sets `_t0`. Every phase end and session tick is an *absolute* deadline counted from `_t0`, and `setTimeout` (via `_at()`) is only used to wake up near each deadline. That way timer jitter never adds up. `loop.js` schedules every layer of every cycle as a one-shot source at `t0 + n·cycleDur` on the same clock, using a look-ahead scheduler. It does not use native `loop`, because file lengths can differ from the cycle length by a few ms and would drift. Each layer is trimmed to its cycle slot. `startTimer` awaits `loopsReady()` (capped at 4s) before anchoring `_t0`. `requestAnimationFrame` is used **only** for the cosmetic countdown number.
- **`TRANSITION_MS = 1200`** (in `session.js`) must match the CSS `--transition` (1.2s). `isTransitioning()` blocks start/stop during this window.
- **Avoiding circular imports:** `session.js` reads limit state through a getter that `main.js` registers with `registerLimitGetter()`, not by importing it from `ui.js`.
- **`window.applyLang`** is exposed by `main.js` for `tutorial.js`, which is not bundled with the modules. `build.js` minifies `tutorial.js` with `toplevel: false` so this global access survives.
- **Mobile audio:** the ambient `AudioContext` must be created synchronously inside a user gesture, so there can be no `await` before `new AudioContext()`. The shared `audioCtx` resumes on mousedown, touchstart, and keydown.
- **Visibility:** when the tab is hidden with no session running, ambient music is suspended. When the tab becomes visible during a session, the wake lock is re-acquired.
- **Language changes** reload the layers (`loadTechniqueLoops(preset, lang)`), so the voice layer switches language from the next scheduled cycle, even mid-session.
- **Layers are always scheduled.** Toggling only changes the layer's gain, so it is instant and never re-syncs. When adding a layer, add it to `LAYER_VOLUME` (and to `_enabled` if it can be turned off) in `loop.js`, add a `.sound-toggle` button in `index.html`, add a default in `sound-controls.js`, and add i18n keys.
- Icon-only buttons get translated `aria-label`/`title` via `data-i18n-label="key"` (handled in `applyLang`).
- The tutorial runs on **every** page load. Nothing in it is persisted. The only localStorage use is the sound preferences.
- Code comments mix English and Spanish (Rioplatense voseo in UI copy: "Tocalo", "respirás"). Match the surrounding style.

## Adding things

- **New technique:** add an entry to `PRESETS` with `soundDir: '<dir>'`, and add `assets/sounds/<dir>/` with `<dir>-breathing.mp3` (phase cues), `<dir>-breaths.mp3`, `<dir>-voice-es.mp3`, and `<dir>-voice-en.mp3`. Every file must be **exactly one cycle long** (the sum of `timing`) and start at the beginning of the inhale. Consider updating the tutorial's "when and how" step in `tutorial.js`.
- **New language:** add a key to `i18n` with every key, add `nameXx`/`tagXx`/`descXx` handling (the code uses `lang === 'es' ? ... : ...` ternaries in `main.js` and `ui.js`), a `<dir>-voice-xx.mp3` per technique, add a `.ctrl-option` to `#lang-dropdown` in `index.html`, and add strings to each tutorial step.
- **New UI string:** add it to both `i18n.es` and `i18n.en`, then use `data-i18n="key"` in the HTML.

## Build pipeline (`build.js`)

It starts by deleting `dist/`, then:

1. Minifies `style.css` with clean-css (level 2).
2. Bundles `assets/js/main.js` with **esbuild** into a single minified IIFE and drops `console.*`.
3. Minifies `tutorial.js` with terser and drops console calls.
4. Rewrites and minifies `index.html`, and injects service worker registration if it is missing.
5. Copies `assets/` (except `js/`) and `manifest.json`.
6. Generates `dist/sw.js`:
   - The shell (html, css, js, icons, manifest) is **cache-first**. The cache name `neyen-shell-<hash>` uses a content hash, so the cache only rolls over when shell files change.
   - `/assets/sounds/*` is **network-first** with a cache fallback (`neyen-sounds`).

   `sw.js` is generated by the build. Never hand-edit it; change `generateServiceWorker()` instead.

## Known issues (as of writing)

- `build.js` string-replaces `<script type="module" src="assets/js/main.js">`, but `index.html` uses `/assets/js/main.js` (leading slash). The replace never matches, so `dist/index.html` still loads the IIFE bundle with `type="module"`. This works, but it doesn't match the build script's intent.
- `index.html` has a duplicate `</head>` and an empty inline `<script>`.
