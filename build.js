const { minify: minifyHTML } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const { minify: minifyJS } = require('terser');
const fs = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────
const SITE_URL = process.env.SITE_URL || 'https://neyenbreath.netlify.app';

const SRC_JS_DIR = './assets/js';
const DIST = './dist';
const DIST_JS = `${DIST}/assets/js`;

// Order matters: each file must come after its dependencies.
// This matches the import graph in the source.
const JS_MODULES = [
  'i18n.js',
  'presets.js',
  'audio.js',
  'loop.js',
  'ui.js',
  'session.js',
  'interactions.js',
  'main.js',
];

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
  ensureDir(DIST);
  ensureDir(DIST_JS);

  // ── CSS ──────────────────────────────────────────────────────
  const css = fs.readFileSync('./style.css', 'utf8');
  const minCSS = new CleanCSS({ level: 2 }).minify(css).styles;
  fs.writeFileSync(`${DIST}/style.css`, minCSS);
  console.log('✓ style.css');

  // ── JS modules (js/*.js) ─────────────────────────────────────
  // Terser accepts a { name: code } map and produces a single minified
  // output. We pass all modules together so it can cross-file mangle
  // safely. Import/export statements are kept (module: true) so the
  // browser still loads them as ES modules.
  const moduleFiles = {};
  for (const filename of JS_MODULES) {
    const srcPath = path.join(SRC_JS_DIR, filename);
    if (!fs.existsSync(srcPath)) {
      console.warn(`  ⚠ ${filename} not found — skipping`);
      continue;
    }
    moduleFiles[filename] = fs.readFileSync(srcPath, 'utf8');
  }

  const jsResult = await minifyJS(moduleFiles, {
    compress: {
      drop_console: true,
      passes: 3,
    },
    mangle: {
      // module: true lets Terser safely rename module-level names
      // because they are not shared via globals.
      module: true,
    },
    module: true,
    format: {
      comments: false,
    },
  });

  // Terser returns a single merged output when given multiple files.
  fs.writeFileSync(`${DIST_JS}/main.js`, jsResult.code);
  console.log('✓ assets/js/ → dist/assets/js/main.js (all modules bundled)');

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
  // Update the module script src to point at the single bundled file.
  let html = fs.readFileSync('./index.html', 'utf8');
  html = html.replaceAll('https://TU-DOMINIO.com', SITE_URL);

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

  console.log('\n🎉 Build listo en /dist');
}

build().catch((err) => {
  console.error('Build failed:', err);
  process.exit(1);
});
