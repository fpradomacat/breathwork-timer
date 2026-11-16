# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

**Neyen** ("the art of breathing"): a guided breathwork timer, built as a static, framework-free PWA in vanilla JS. It is deployed to Netlify at https://neyenbreath.netlify.app. The UI is bilingual (Spanish is the default, plus English). It is mobile-first and runs in portrait orientation.

The user taps the breathing circle to start or stop a session. The circle expands and contracts through each phase (inhale, hold full, exhale, hold empty). A voiced "helper" audio loop guides the first N cycles, then a clean loop without voice takes over. Background ambient music plays separately.

## Commands

```bash
npm install
npm run build        # node build.js → produces ./dist (gitignored)
```

- There are no tests (`npm test` is the npm placeholder) and no linter config.
- There is no dev server script. Serve the repo root over **http** to develop, for example `npx serve .` or VS Code Live Server. Asset paths are absolute (`/assets/...`), so the server root must be the repo root. On `file://`, Web Audio decoding is skipped and the loops fall back to `HTMLAudioElement`, and ambient music won't load.
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
assets/sounds/      mp3 loops, helper voice tracks, background music
assets/icons/       PWA icons + og-image
dist/               build output (gitignored; may contain stale files like script.js)
```

### JS modules (`assets/js/`)

`main.js` is the entry point and the only module that imports everything. It wires the modules together and holds the active technique state (`activeTechniqueName`, `times`).

| Module | Responsibility |
|---|---|
| `presets.js` | `PRESETS` array: names, tags, and descriptions (Es/En); `timing: [inhale, holdFull, exhale, holdEmpty]` in seconds; sound file paths; `helperCycles`; optional `autoLimitCycles` |
| `i18n.js` | `i18n.es` / `i18n.en` string tables. Some entries are functions for dynamic strings. Every key must exist in both languages |
| `ui.js` | DOM-only concerns: `lang` (exported `let`), `applyLang`, technique label, session limits (`limitType`/`limitValue`/`checkLimit`), modals, toast, preset card rendering, `formatTime`, `setCircleState` |
| `session.js` | Session state machine and timing: start/stop, phase cycle, counters, wake lock, a silent keep-alive oscillator (prevents Bluetooth audio dropouts) |
| `loop.js` | Technique audio loops: plays the helper (voiced) track for `helperCycles` cycles, then switches to the base track. Uses Web Audio buffers, with `HTMLAudioElement` as a fallback. Caches decoded buffers |
| `audio.js` | Shared `audioCtx` plus synthesized UI sounds (tones, clicks, chimes). Also `ambient`, the background music player, which has its **own separate AudioContext** so it can be suspended independently |
| `interactions.js` | Hover/click sounds, haptics, and keyboard shortcuts (Space = start/stop, Esc = close modals). Never owns session state; it calls callbacks |

## Key conventions & gotchas

- **Timing strategy:** `audioCtx.currentTime` is the single master clock. At session start, `session.js` sets `_t0`. Every phase end and session tick is an *absolute* deadline counted from `_t0`, and `setTimeout` (via `_at()`) is only used to wake up near each deadline. That way timer jitter never adds up. `loop.js` schedules each technique audio cycle as a one-shot source at `t0 + n·cycleDur` on the same clock, using a look-ahead scheduler. It does not use native `loop`, because the mp3 lengths differ from the cycle length by a few ms and would drift. Loop mp3s must be exactly one cycle long. `requestAnimationFrame` is used **only** for the cosmetic countdown number.
- **`TRANSITION_MS = 1200`** (in `session.js`) must match the CSS `--transition` (1.2s). `isTransitioning()` blocks start/stop during this window.
- **Avoiding circular imports:** `session.js` reads limit state through a getter that `main.js` registers with `registerLimitGetter()`, not by importing it from `ui.js`.
- **`window.applyLang`** is exposed by `main.js` for `tutorial.js`, which is not bundled with the modules. `build.js` minifies `tutorial.js` with `toplevel: false` so this global access survives.
- **Mobile audio:** the ambient `AudioContext` must be created synchronously inside a user gesture, so there can be no `await` before `new AudioContext()`. The shared `audioCtx` resumes on mousedown, touchstart, and keydown.
- **Visibility:** when the tab is hidden with no session running, ambient music is suspended. When the tab becomes visible during a session, the wake lock is re-acquired.
- **Language changes** call `invalidateLoopCache()` and reload loops so the helper voice track matches the new language.
- The tutorial runs on **every** page load. Nothing in it is persisted, and the code uses no localStorage.
- Code comments mix English and Spanish (Rioplatense voseo in UI copy: "Tocalo", "respirás"). Match the surrounding style.

## Adding things

- **New technique:** add an entry to `PRESETS` and add three mp3s to `assets/sounds/`: `<name>.mp3`, `<name>-helper-es.mp3`, and `<name>-helper-en.mp3`. Consider updating the tutorial's "when and how" step in `tutorial.js`.
- **New language:** add a key to `i18n` with every key, add `nameXx`/`tagXx`/`descXx`/`soundFileXx` handling (the code currently uses `lang === 'es' ? ... : ...` ternaries in `main.js`, `ui.js`, and `loop.js`), add a `.ctrl-option` to `#lang-dropdown` in `index.html`, and add strings to each tutorial step.
- **New UI string:** add it to both `i18n.es` and `i18n.en`, then use `data-i18n="key"` in the HTML.

## Build pipeline (`build.js`)

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

- `main.js` `_onPresetSelected` references `session.TRANSITION_MS`, but no `session` namespace is imported (`TRANSITION_MS` is imported directly). Picking a technique while a session is running stops the session and then throws a ReferenceError, so it never restarts.
- `build.js` string-replaces `<script type="module" src="assets/js/main.js">`, but `index.html` uses `/assets/js/main.js` (leading slash). The replace never matches, so `dist/index.html` still loads the IIFE bundle with `type="module"`. This works, but it doesn't match the build script's intent.
- `index.html` has a duplicate `</head>` and an empty inline `<script>`.
- `assets/sounds/backup/`, `assets/sounds/breathings/`, `inhala.mp3`, `exhala.mp3`, and `pausa.mp3` appear unused by current code. They still get copied into `dist`.
