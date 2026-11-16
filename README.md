# Neyen — the art of breathing

A guided breathing timer that runs in the browser and can be installed on your phone as an app (PWA).

**Live:** https://neyenbreath.netlify.app

## What it does

Pick a breathing technique and tap the circle. The circle grows as you inhale and shrinks as you exhale, and a voice guides you through the first few cycles. After that the voice drops out and you keep breathing to the rhythm.

| Technique | Pattern (in · hold · out · hold) | Good for |
|---|---|---|
| Box Breathing | 4 · 4 · 4 · 4 | Balance |
| Cardiac Coherence | 5 · 0 · 5 · 0 | Calm |
| 4-7-8 Relaxing | 4 · 7 · 8 · 0 | Sleep |
| Fire Breath | 1 · 0 · 1 · 0 (auto-stops after 30 cycles) | Energy |

Other features:

- Spanish and English (UI and voice guidance)
- Ambient background music you can mute
- Session timer, cycle counter, and last-session summary
- Keeps the screen awake during a session, with haptic feedback on phase changes
- Keyboard shortcuts: **Space** starts or stops a session, **Esc** closes dialogs
- A short onboarding tutorial on launch
- Works offline once installed

## How it works

The app is plain HTML, CSS, and vanilla JavaScript, with no framework.

- **`index.html`** is the single page.
- **`assets/js/`** holds the app logic as ES modules. `main.js` is the entry point:
  - `presets.js`: the breathing techniques (timings and audio files)
  - `session.js`: the session clock, the breathing phases, and the counters
  - `loop.js`: plays the technique audio (the voiced helper first, then the clean loop)
  - `audio.js`: UI sounds and ambient music
  - `ui.js`, `i18n.js`, `interactions.js`: the DOM, translations, and input handling
- **`tutorial.js`** is the onboarding overlay.
- **`build.js`** bundles and minifies everything into `dist/` and generates a service worker for offline use.

Timing is driven by the Web Audio clock. The voice, the breathing circle, and the counters all follow the same timeline, so they stay in sync for the whole session.

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

There are no automated tests. Testing means running the app and trying it out.

## Support

If you enjoy it, you can [buy me a coffee](https://buymeacoffee.com/soypradito) ☕ · [@soypradito](https://instagram.com/soypradito)
