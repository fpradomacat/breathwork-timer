const { minify: minifyHTML } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const { minify: minifyJS } = require('terser');
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Config ────────────────────────────────────────────────────
const SITE_URL = process.env.SITE_URL || 'https://neyenbreath.netlify.app';

const SRC_JS_DIR = './assets/js';
const DIST = './dist';
const DIST_JS = `${DIST}/assets/js`;

// ── Helpers ───────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyDirRecursive(src, dest) {
  ensureDir(dest);
  fs.readdirSync(src).forEach((entry) => {
    const srcPath = path.join(src, entry);
    const destPath = path.join(dest, entry);
    fs.statSync(srcPath).isDirectory()
      ? copyDirRecursive(srcPath, destPath)
      : fs.copyFileSync(srcPath, destPath);
  });
}

// ── Build ─────────────────────────────────────────────────────
async function build() {
  // Start from a clean dist so removed files (e.g. old sounds) don't linger
  fs.rmSync(DIST, { recursive: true, force: true });
  ensureDir(DIST);
  ensureDir(DIST_JS);

  // ── CSS ──────────────────────────────────────────────────────
  const css = fs.readFileSync('./style.css', 'utf8');
  const minCSS = new CleanCSS({ level: 2 }).minify(css).styles;
  fs.writeFileSync(`${DIST}/style.css`, minCSS);
  console.log('✓ style.css');

  // ── JS bundle (esbuild) ──────────────────────────────────────
  // esbuild resolves all imports starting from main.js and produces
  // a single self-contained IIFE — no import/export in the output,
  // works in every browser without module support concerns.
  ensureDir(DIST_JS);
  await esbuild.build({
    entryPoints: [`${SRC_JS_DIR}/main.js`],
    bundle: true,
    minify: true,
    format: 'iife',
    drop: ['console'],
    outfile: `${DIST_JS}/main.js`,
  });
  console.log('✓ assets/js/ → dist/assets/js/main.js (bundled)');

  // ── tutorial.js (IIFE — processed separately) ─────────────────
  // tutorial.js is a non-module IIFE. It reads window.applyLang which
  // is a global set by main.js, so toplevel mangling must stay off.
  const tutorialSrc = fs.readFileSync('./tutorial.js', 'utf8');
  const tutResult = await minifyJS(tutorialSrc, {
    compress: {
      drop_console: true,
      passes: 3,
    },
    mangle: {
      toplevel: false, // exposes window.applyLang via global — do not rename
    },
    format: {
      comments: false,
    },
  });
  fs.writeFileSync(`${DIST}/tutorial.js`, tutResult.code);
  console.log('✓ tutorial.js');

  // ── HTML ──────────────────────────────────────────────────────
  // The JS bundle is an IIFE — swap type="module" for defer (modules are
  // deferred by default, and main.js expects the DOM to be parsed).
  let html = fs.readFileSync('./index.html', 'utf8');
  html = html.replaceAll('https://TU-DOMINIO.com', SITE_URL);
  const moduleTag = '<script type="module" src="/assets/js/main.js"></script>';
  if (!html.includes(moduleTag))
    throw new Error(`index.html: expected ${moduleTag} (build.js rewrites it)`);
  html = html.replace(
    moduleTag,
    '<script defer src="/assets/js/main.js"></script>',
  );
  html = html.replace(
    '<script type="module" src="tutorial.js"></script>',
    '<script defer src="tutorial.js"></script>',
  );

  // Registro del service worker (si el HTML fuente no lo tiene ya)
  if (!html.includes('serviceWorker')) {
    const swRegister = `<script>if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'));}</script>`;
    html = html.replace('</body>', `${swRegister}</body>`);
  }

  const minHTML = await minifyHTML(html, {
    collapseWhitespace: true,
    removeComments: true,
    removeAttributeQuotes: true,
    minifyCSS: true,
    minifyJS: true,
  });
  fs.writeFileSync(`${DIST}/index.html`, minHTML);
  console.log('✓ index.html');

  // ── Assets (sounds/, ico/ — js/ is handled by the bundle step) ─
  if (fs.existsSync('./assets')) {
    fs.readdirSync('./assets').forEach((entry) => {
      if (entry === 'js') return; // already written as minified bundle
      const srcPath = path.join('./assets', entry);
      const destPath = path.join(`${DIST}/assets`, entry);
      fs.statSync(srcPath).isDirectory()
        ? copyDirRecursive(srcPath, destPath)
        : fs.copyFileSync(srcPath, destPath);
    });
    console.log('✓ assets/sounds, assets/ico');
  }

  // ── Manifest ──────────────────────────────────────────────────
  if (fs.existsSync('./manifest.json')) {
    fs.copyFileSync('./manifest.json', `${DIST}/manifest.json`);
    console.log('✓ manifest.json');
  }

  // ── Service Worker ──────────────────────────────────────────────
  // Everything is precached at install, so the app works fully offline
  // (sounds included) from the first visit. Two caches, each named after
  // a hash of its content, so a deploy only re-downloads what changed:
  //  - shell  (html/css/js/icons/manifest)
  //  - sounds (all of assets/sounds, ~1.5 MB)
  // Both are cache-first. A new version activates right away; the page
  // then offers to reload (see main.js, "new version" toast).
  generateServiceWorker();
  console.log('✓ sw.js');

  console.log('\n🎉 Build listo en /dist');
}

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return fs.statSync(full).isDirectory()
      ? listFilesRecursive(full)
      : [full];
  });
}

function contentHash(files) {
  const hash = crypto.createHash('sha256');
  [...files].sort().forEach((f) => {
    hash.update(f);
    hash.update(fs.readFileSync(f));
  });
  return hash.digest('hex').slice(0, 10);
}

const toUrl = (f) => '/' + path.relative(DIST, f).split(path.sep).join('/');

function generateServiceWorker() {
  const soundsDir = path.normalize(`${DIST}/assets/sounds`);
  const soundFiles = listFilesRecursive(soundsDir);
  const shellFiles = [
    `${DIST}/index.html`,
    `${DIST}/style.css`,
    `${DIST}/tutorial.js`,
    `${DIST}/manifest.json`,
    ...listFilesRecursive(`${DIST}/assets`).filter((f) => !f.startsWith(soundsDir)),
  ].filter((f, i, arr) => fs.existsSync(f) && arr.indexOf(f) === i);

  const shellVersion = contentHash(shellFiles);
  const soundsVersion = contentHash(soundFiles);

  const swSource = `// Auto-generated by build.js — do not edit by hand
const SHELL_CACHE = 'neyen-shell-${shellVersion}';
const SOUNDS_CACHE = 'neyen-sounds-${soundsVersion}';

const SHELL_URLS = ${JSON.stringify(shellFiles.map(toUrl), null, 2)};
const SOUND_URLS = ${JSON.stringify(soundFiles.map(toUrl), null, 2)};

async function precache(name, urls) {
  // Same content hash → already cached by a previous version
  if (await caches.has(name)) return;
  const cache = await caches.open(name);
  await cache.addAll(urls);
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([
      precache(SHELL_CACHE, SHELL_URLS),
      precache(SOUNDS_CACHE, SOUND_URLS),
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  const keep = [SHELL_CACHE, SOUNDS_CACHE];
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith('neyen-') && !keep.includes(key))
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // Page navigations ("/", "/?source=pwa"…) are served the cached index.html
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html').then((cached) => cached || fetch(request))
    );
    return;
  }

  // Everything else: cache-first, network as fallback
  event.respondWith(
    caches.match(request).then((cached) => cached || fetch(request))
  );
});
`;

  fs.writeFileSync(`${DIST}/sw.js`, swSource);
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});