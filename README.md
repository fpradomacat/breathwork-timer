# Neyen — the art of breathing

A guided breathing timer that runs in the browser and can be installed on your phone as an app (PWA).

**Live:** https://neyenbreath.netlify.app

## What it does

Pick a breathing technique and tap the circle. After a short 3-2-1 countdown, the circle grows as you inhale and shrinks as you exhale, and a voice guides you through the first few cycles. After that the voice drops out and you keep breathing to the rhythm.

| Technique         | Pattern (in · hold · out · hold)           | Good for |
| ----------------- | ------------------------------------------ | -------- |
| Box Breathing     | 4 · 4 · 4 · 4                              | Balance  |
| Cardiac Coherence | 5 · 0 · 5 · 0                              | Calm     |
| 4-7-8 Relaxing    | 4 · 7 · 8 · 0                              | Sleep    |
| Fire Breath       | 1 · 0 · 1 · 0 (auto-stops after 30 cycles) | Energy   |

Fire Breath and 4-7-8 show a safety note on their card, and a short notice the first time you pick them.

Other features:

- **Spanish and English** (UI, voice guidance and the page content), each published as its own URL (`/` and `/en.html`); switch with the button in the top-right corner.
- **Session length:** tap the ⏱ pill next to "Techniques" to pick ∞ / 3 / 5 / 10 / 15 minutes.
- **Sound controls** that work even during a session:

  - 🎵 ambient music
  - 🗣️ voice guide
  - 🌬️ breathing sound
  - ⏱️ a tick every second

  🎚️ opens a panel with a volume slider for each one, plus the interface sounds. The sounds that mark each phase always play.

- **After each session:** a short summary, and a "how do you feel?" question.
- **Your practice:** a 🔥 day streak, plus a history of your sessions (tap the streak). Everything stays on your device; there are no accounts.
- Lock-screen controls on phones (technique name + stop button).
- Keeps the screen awake during a session, with haptic feedback on phase changes.
- **Keyboard:** **Space** starts or stops a session, **Esc** closes dialogs, and everything is reachable with **Tab**.
- An onboarding tutorial on your first visit (**?** in the top-right corner shows it again).
- Works fully offline once loaded, sounds included.
- **Below the app:** what each technique is, how and when to practise it, and a FAQ — real text in the page, in both languages.

Your preferences (language, sounds, session length) are remembered between visits.

## How it works

The app is plain HTML, CSS, and vanilla JavaScript, with no framework.

- **`index.html`** is the Spanish source page. The build writes one page per language from it (`index.html`, `en.html`), each with its own title, canonical, `hreflang`, link preview and JSON-LD.
- **`assets/js/`** holds the app logic as ES modules. `main.js` is the entry point:
  - `presets.js`: the breathing techniques (timings, sound folder, safety notes)
  - `session.js`: the session clock, countdown, breathing phases and counters
  - `loop.js`: plays the technique audio as separate layers in sync
  - `sound-controls.js`: the sound buttons, the volume panel, and saved preferences
  - `audio.js`: UI sounds and ambient music
  - `history.js` / `practice.js`: session history, streak, summary and history screens
  - `media-session.js`: lock-screen controls
  - `ui.js`, `i18n.js`, `interactions.js`, `storage.js`: the DOM, translations, input handling, saved preferences
  - `seo-content.js`: the content under the app (intro, techniques, FAQ, author) in both languages
- **`tutorial.js`** is the onboarding overlay.
- **`build.js`** bundles and minifies everything into `dist/`, writes each language page plus `sitemap.xml` and `robots.txt`, and generates a service worker for offline use. Set `SITE_URL` to the public URL of the site (a custom domain included) — every absolute URL is built from it.

Each technique has its own folder in `assets/sounds/` with one file per sound layer. Each file is exactly one breathing cycle long:

| File                                         | Contents                          | Can be turned off |
| -------------------------------------------- | --------------------------------- | ----------------- |
| `<technique>-breathing.mp3`                  | Phase cues (inhale, hold, exhale) | No                |
| `<technique>-breaths.mp3`                    | The breathing sound               | Yes               |
| `<technique>-voice-es.mp3` / `-voice-en.mp3` | Voice guide                       | Yes               |

The second ticks are generated in code.

Timing is driven by the Web Audio clock. Every sound layer, the breathing circle, and the counters all follow the same timeline, so they stay in sync for the whole session. Turning a sound off just fades that layer's volume, so it can be switched at any moment without breaking the rhythm.

## Running locally

You need [Node.js](https://nodejs.org/) (only for the build) and an HTTP server. Opening `index.html` directly as a file won't work properly, because audio loading needs `http://`.

### Development (source files)

1. Install the [Live Server](https://marketplace.visualstudio.com/items?itemName=ritwickdey.LiveServer) extension in VS Code.
2. Open the **repository root folder** in VS Code. Asset paths start with `/`, so the server must serve from the root.
3. Right-click `index.html` and choose **Open with Live Server**, or click **Go Live** in the status bar.

The app opens at `http://127.0.0.1:5500` and reloads when you save a file.

Any other static server works too, for example `npx serve .`.

### Production build

```bash
npm install
npm run build
```

This writes the optimized site to `dist/`, including `sw.js`, the service worker that makes the app work offline. To test the build, serve the `dist/` folder as the server root. Either of these works:

- `npx serve dist`
- With Live Server, add `"liveServer.settings.root": "/dist"` to `.vscode/settings.json`, then click **Go Live**.

> **Tip:** when testing the build, the service worker caches the app. If you don't see your changes, hard-reload the page, or in DevTools go to **Application → Service Workers** and click **Unregister**.

### Testing on your phone

Testing on a real phone is the best way to check audio, wake lock, and vibration. Connect the phone to the same Wi-Fi network as your computer, then open `http://<your-computer-ip>:5500`.

Browsers only allow the service worker and screen wake lock on `localhost` or HTTPS. Over a LAN IP they won't work, but everything else will.

### Tests and formatting

```bash
npm test               # unit tests (audio scheduler, history/streak, translations & presets)
npm run format         # format the code with Prettier
npm run format:check   # check formatting without changing files
```

The unit tests cover the logic. For anything visual or audio-related, run the app and try it.

### Adding a technique

1. Export one file per layer from Audacity into `assets/sounds/<name>/`:

   - `<name>-breathing.mp3`
   - `<name>-breaths.mp3`
   - `<name>-voice-es.mp3`
   - `<name>-voice-en.mp3`

   Each file must be **exactly one cycle long** and start at the beginning of the inhale.

2. Add an entry to `assets/js/presets.js` with `soundDir: '<name>'` and its timings. Timings can be fractional, for example 5.5 s.
3. Run `npm test`. It checks that the preset is complete and that its 4 files exist.

## Support

If you enjoy it, you can [buy me a coffee](https://buymeacoffee.com/soypradito) ☕ · [@soypradito](https://instagram.com/soypradito)
