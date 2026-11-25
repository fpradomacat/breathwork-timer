const { minify: minifyHTML } = require('html-minifier-terser');
const CleanCSS = require('clean-css');
const { minify: minifyJS } = require('terser');
const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Config ────────────────────────────────────────────────────
// Public URL of the deployed site, including any sub-path
// (e.g. https://user.github.io/repo). Only used for absolute URLs
// (og:image, canonical, reminder .ics). Every other path in the output is
// relative, so the site works at the root of a domain or under /<repo>/.
const SITE_URL = (
  process.env.SITE_URL || 'https://neyenbreath.netlify.app'
).replace(/\/+$/, '');

const SRC_JS_DIR = './assets/js';
// Stylesheets in load order (see index.html)
const CSS_FILES = ['tokens.css', 'tokens-dark.css', 'style.css'];
const DIST = './dist';
const DIST_JS = `${DIST}/assets/js`;

// ── Helpers ───────────────────────────────────────────────────
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

/** Escape a value going into a double-quoted HTML attribute. */
function attr(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Replace exactly one occurrence, or fail loudly. */
function replaceOnce(html, pattern, replacement, what) {
  const matches = html.match(
    pattern instanceof RegExp
      ? new RegExp(pattern.source, pattern.flags.replace('g', '') + 'g')
      : new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
  );
  if (!matches || matches.length !== 1)
    throw new Error(
      `index.html: expected exactly one ${what}, found ${matches ? matches.length : 0}`,
    );
  return html.replace(pattern, replacement);
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
  // Start from a clean dist so removed files (e.g. old sounds) don't linger.
  // Empty it rather than deleting it: on Windows the folder itself can't be
  // removed while something (a terminal, a local server) has it open.
  ensureDir(DIST);
  for (const entry of fs.readdirSync(DIST))
    fs.rmSync(path.join(DIST, entry), { recursive: true, force: true });
  ensureDir(DIST_JS);

  // ── CSS ──────────────────────────────────────────────────────
  // The design system's tokens (tokens.css, then the night variant
  // tokens-dark.css) load before style.css, which only uses their
  // variables. Three files, in that order, as index.html links them.
  for (const file of CSS_FILES) {
    const css = fs.readFileSync(`./${file}`, 'utf8');
    const minCSS = new CleanCSS({ level: 2 }).minify(css).styles;
    fs.writeFileSync(`${DIST}/${file}`, minCSS);
    console.log(`✓ ${file}`);
  }

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

  // ── HTML: one page per language ───────────────────────────────
  // index.html is the Spanish source. Every language in PAGES gets its own
  // page (es → index.html, en → en.html) with its own <title>, canonical,
  // hreflang set, link preview, JSON-LD and landing copy, so search
  // engines have one indexable URL per language instead of one page that
  // rewrites itself with JS.
  //
  // Each technique gets the same treatment (respiracion-4-7-8.html,
  // 4-7-8-breathing.html…): the full app with that technique already
  // chosen, and copy about it — one URL per search intent. The slugs live
  // in seo-content.js (SEO[lang].techniques[dir].slug).
  //
  // Every page lives in the site root (flat files, never folders), so all
  // relative paths (assets, sw.js, reminder/) resolve the same way from
  // any of them.
  const seo = await import('./assets/js/seo-content.js');
  const { i18n } = await import('./assets/js/i18n.js');

  // The JS bundle is an IIFE — swap type="module" for defer (modules are
  // deferred by default, and main.js expects the DOM to be parsed).
  let common = fs.readFileSync('./index.html', 'utf8');
  common = common.replaceAll('https://TU-DOMINIO.com', SITE_URL);
  common = common.replaceAll('https://neyenbreath.netlify.app', SITE_URL);
  const moduleTag = '<script type="module" src="/assets/js/main.js"></script>';
  if (!common.includes(moduleTag))
    throw new Error(`index.html: expected ${moduleTag} (build.js rewrites it)`);
  common = common.replace(
    moduleTag,
    '<script defer src="assets/js/main.js"></script>',
  );
  common = common.replace(
    '<script type="module" src="tutorial.js"></script>',
    '<script defer src="tutorial.js"></script>',
  );

  // Registro del service worker (si el HTML fuente no lo tiene ya)
  if (!common.includes('serviceWorker')) {
    const swRegister = `<script>if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js'));}</script>`;
    common = common.replace('</body>', `${swRegister}</body>`);
  }

  for (const technique of seo.pageIds())
    for (const lang of Object.keys(seo.PAGES)) {
      const html = languagePage(common, lang, technique, seo, i18n);
      const file = seo.pagePath(lang, technique) || 'index.html';
      const minHTML = await minifyHTML(html, {
        collapseWhitespace: true,
        removeComments: true,
        // Keep quotes: WhatsApp's link-preview scraper ignores unquoted
        // <meta property=og:image content=...> and shows no image.
        removeAttributeQuotes: false,
        minifyCSS: true,
        minifyJS: true,
      });
      assertPage(minHTML, file, lang, technique, seo);
      fs.writeFileSync(`${DIST}/${file}`, minHTML);
      console.log(`✓ ${file} (${lang}${technique ? `, ${technique}` : ''})`);
    }

  // ── Crawler files ─────────────────────────────────────────────
  fs.writeFileSync(`${DIST}/sitemap.xml`, sitemap(seo));
  // Note: a GitHub Pages *project* site serves robots.txt from the user
  // root (user.github.io/robots.txt), not from /<repo>/, so this file only
  // takes effect once the site runs on its own domain. Submit the sitemap
  // URL in Search Console meanwhile.
  fs.writeFileSync(
    `${DIST}/robots.txt`,
    `User-agent: *\nAllow: /\n\nSitemap: ${SITE_URL}/sitemap.xml\n`,
  );
  console.log('✓ sitemap.xml + robots.txt');

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

  // ── Daily reminder: one .ics per half hour and language ─────
  // Static files (not precached) so iOS opens its "Add to Calendar" sheet.
  // See assets/js/reminder-ics.js.
  const { REMINDER_SLOTS, icsPath, buildIcs } = await import(
    './assets/js/reminder-ics.js'
  );
  for (const lang of Object.keys(i18n))
    for (const time of REMINDER_SLOTS) {
      const file = `${DIST}${icsPath(lang, time)}`;
      ensureDir(path.dirname(file));
      fs.writeFileSync(
        file,
        buildIcs({
          time,
          lang,
          startDate: new Date(),
          siteUrl: `${SITE_URL}/`,
        }),
      );
    }
  fs.writeFileSync(
    `${DIST}/_headers`,
    '/reminder/*\n  Content-Type: text/calendar; charset=utf-8\n',
  );
  console.log('✓ reminder/*.ics + _headers');

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

// ── Per-language page ─────────────────────────────────────────
const OG_IMAGE = `${SITE_URL}/assets/icons/og-image.jpg?v=5`;

/**
 * Fail the build on a page that came out wrong. The rewrites are pattern
 * based, so a stray match can silently drop part of the head — cheaper to
 * catch here than in Search Console three weeks later.
 */
function assertPage(html, file, lang, technique, seo) {
  const required = [
    `<title>${seo.pageMeta(lang, technique).title}`,
    'name="description"',
    `rel="canonical" href="${pageUrl(seo, lang, technique)}"`,
    'rel="alternate" hreflang="x-default"',
    'application/ld+json',
    'style.css',
    'manifest.json',
    `data-page-lang="${lang}"`,
    seo.faqItems(lang, technique)[0].q,
    ...(technique ? [`data-page-technique="${technique}"`] : []),
  ];
  for (const needle of required)
    if (!html.includes(needle))
      throw new Error(`${file}: missing ${JSON.stringify(needle)}`);
  if (html.includes('<!--'))
    throw new Error(`${file}: unterminated HTML comment`);
}

/** Absolute URL of a page (technique null = home). */
function pageUrl(seo, lang, technique = null) {
  return `${SITE_URL}/${seo.pagePath(lang, technique)}`;
}

/**
 * Turn the Spanish source HTML into one page — a language, and a
 * technique or null for home: html lang, title, description, the
 * absolute-URL head block, the landing copy and the language button's
 * target.
 */
function languagePage(html, lang, technique, seo, i18n) {
  const meta = seo.pageMeta(lang, technique);
  const other = lang === 'es' ? 'en' : 'es';

  let out = replaceOnce(
    html,
    '<html lang="es">',
    () =>
      `<html lang="${lang}" data-page-lang="${lang}"${technique ? ` data-page-technique="${attr(technique)}"` : ''}>`,
    '<html lang="es"> tag',
  );
  out = replaceOnce(
    out,
    /<title>[\s\S]*?<\/title>/,
    () => `<title>${attr(meta.title)}</title>`,
    '<title> tag',
  );
  out = replaceOnce(
    out,
    /<meta\s+name="description"[\s\S]*?\/>/,
    () => `<meta name="description" content="${attr(meta.description)}" />`,
    'description meta tag',
  );
  out = replaceOnce(
    out,
    '<!-- SEO-HEAD -->',
    () => seoHead(lang, technique, seo),
    'SEO-HEAD marker',
  );
  out = replaceOnce(
    out,
    /<section class="seo" id="info">\s*<\/section>/,
    () =>
      `<section class="seo" id="info">${seo.renderPage(lang, technique, { built: true })}</section>`,
    '#info section',
  );
  // Switching language navigates to the same page in the other language
  // (see main.js)
  out = replaceOnce(
    out,
    'id="lang-btn"',
    // lang: the button is written in the other language ("English")
    () =>
      `id="lang-btn" lang="${other}" data-href="${attr(seo.pageHref(other, technique))}"`,
    'lang-btn id',
  );
  return translateStaticText(out, lang, i18n);
}

/**
 * Apply i18n to the static markup, the same way ui.js applyLang() does at
 * runtime: [data-i18n] text and [data-i18n-label] aria-label/title.
 *
 * The source HTML ships in Spanish, so without this the English page
 * would be served with Spanish buttons and repaint once the bundle runs.
 * Only elements whose content is a single text node are touched (`[^<]*`)
 * — anything with nested markup is left to the runtime.
 */
function translateStaticText(html, lang, i18n) {
  const t = i18n[lang];

  let out = html.replace(
    /(<(\w+)([^>]*\sdata-i18n="([A-Za-z0-9_]+)"[^>]*)>)([^<]*)(<\/\2\s*>)/g,
    (match, open, _tag, _attrs, key, _text, close) => {
      const value = t[key];
      return typeof value === 'string'
        ? `${open}${attr(value)}${close}`
        : match;
    },
  );

  out = out.replace(
    /<(\w+)([^>]*\sdata-i18n-label="([A-Za-z0-9_]+)"[^>]*)>/g,
    (match, tag, attrs, key) => {
      const value = t[key];
      if (typeof value !== 'string') return match;
      return `<${tag}${attrs
        .replace(/\saria-label="[^"]*"/, ` aria-label="${attr(value)}"`)
        .replace(/\stitle="[^"]*"/, ` title="${attr(value)}"`)}>`;
    },
  );

  return out;
}

/** canonical + hreflang + link preview + JSON-LD for one page. */
function seoHead(lang, technique, seo) {
  const meta = seo.pageMeta(lang, technique);
  const url = pageUrl(seo, lang, technique);
  // Home keeps the brand in link previews; a technique page is shared for
  // the technique, so its preview says which one
  const shareTitle = technique ? meta.title : seo.SEO[lang].shareTitle;
  const alternates = Object.keys(seo.PAGES)
    .map(
      (l) =>
        `<link rel="alternate" hreflang="${seo.PAGES[l].hreflang}" href="${attr(pageUrl(seo, l, technique))}" />`,
    )
    .join('\n    ');
  const otherLocales = Object.keys(seo.PAGES)
    .filter((l) => l !== lang)
    .map(
      (l) =>
        `<meta property="og:locale:alternate" content="${seo.PAGES[l].ogLocale}" />`,
    )
    .join('\n    ');

  return `<link rel="canonical" href="${attr(url)}" />

    <!-- One indexable URL per language, plus the fallback Google serves
         when the visitor's language matches none of them. -->
    ${alternates}
    <link rel="alternate" hreflang="x-default" href="${attr(pageUrl(seo, seo.DEFAULT_LANG, technique))}" />

    <!-- ── Open Graph (WhatsApp, Telegram, LinkedIn…) ── -->
    <!-- JPEG (no alpha) + explicit size: WhatsApp skips or drops images it
         can't size up front. Bump ?v= when the image changes, since
         WhatsApp/Facebook cache previews per image URL. -->
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Neyen" />
    <meta property="og:locale" content="${seo.PAGES[lang].ogLocale}" />
    ${otherLocales}
    <meta property="og:title" content="${attr(shareTitle)}" />
    <meta property="og:description" content="${attr(meta.description)}" />
    <meta property="og:url" content="${attr(url)}" />
    <meta property="og:image" content="${attr(OG_IMAGE)}" />
    <meta property="og:image:secure_url" content="${attr(OG_IMAGE)}" />
    <meta property="og:image:type" content="image/jpeg" />
    <meta property="og:image:width" content="800" />
    <meta property="og:image:height" content="800" />
    <meta property="og:image:alt" content="${attr(shareTitle)}" />

    <!-- ── Twitter / X ──────────────────────────────── -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="${attr(shareTitle)}" />
    <meta name="twitter:description" content="${attr(meta.description)}" />
    <meta name="twitter:image" content="${attr(OG_IMAGE)}" />
    <meta name="twitter:image:alt" content="${attr(shareTitle)}" />

    <!-- ── Structured data ──────────────────────────── -->
    <script type="application/ld+json">
      ${jsonLd(lang, technique, seo)}
    </script>`;
}

/**
 * One @graph per page. Home: WebApplication + Person + FAQPage. A
 * technique page: WebPage (part of the app) + BreadcrumbList + Person +
 * FAQPage with that technique's entries.
 * The FAQ entries are the same strings the page shows (Google requires
 * the visible content and the markup to match).
 */
function jsonLd(lang, technique, seo) {
  const c = seo.SEO[lang];
  const homeUrl = pageUrl(seo, lang);
  const url = pageUrl(seo, lang, technique);
  const meta = seo.pageMeta(lang, technique);
  const inLanguage = seo.PAGES[lang].hreflang;
  const pageNodes = technique
    ? [
        {
          '@type': 'WebPage',
          '@id': `${url}#page`,
          name: meta.title,
          url,
          description: meta.description,
          inLanguage,
          isPartOf: { '@id': `${homeUrl}#app` },
          breadcrumb: { '@id': `${url}#breadcrumb` },
          author: { '@id': `${SITE_URL}/#author` },
        },
        {
          '@type': 'BreadcrumbList',
          '@id': `${url}#breadcrumb`,
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Neyen', item: homeUrl },
            {
              '@type': 'ListItem',
              position: 2,
              name: seo.techniqueName(lang, technique),
              item: url,
            },
          ],
        },
      ]
    : [];
  const graph = [
    ...pageNodes,
    {
      '@type': 'WebApplication',
      '@id': `${homeUrl}#app`,
      name: 'Neyen',
      alternateName: c.shareTitle,
      url: homeUrl,
      description: c.metaDescription,
      inLanguage: seo.PAGES[lang].hreflang,
      applicationCategory: 'HealthApplication',
      operatingSystem: 'Any (web browser)',
      browserRequirements: 'Requires JavaScript',
      image: OG_IMAGE,
      isAccessibleForFree: true,
      offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
      author: { '@id': `${SITE_URL}/#author` },
    },
    {
      '@type': 'Person',
      '@id': `${SITE_URL}/#author`,
      name: seo.AUTHOR.name,
      url: seo.AUTHOR.web,
      email: `mailto:${seo.AUTHOR.email}`,
      sameAs: [seo.AUTHOR.web, seo.AUTHOR.youtube],
    },
    {
      '@type': 'FAQPage',
      '@id': `${url}#faq`,
      inLanguage: seo.PAGES[lang].hreflang,
      mainEntity: seo.faqItems(lang, technique).map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ];
  // Escaped < so no string in the data can close the <script> element
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph })
    .replace(/</g, '\\u003c')
    .replace(new RegExp('[\\u2028\\u2029]', 'g'), '');
}

/** sitemap.xml, with each page listing its every language as an alternate. */
function sitemap(seo) {
  const langs = Object.keys(seo.PAGES);
  const lastmod = new Date().toISOString().slice(0, 10);

  const urls = seo
    .pageIds()
    .flatMap((technique) => {
      const alternates = [
        ...langs.map(
          (l) =>
            `    <xhtml:link rel="alternate" hreflang="${seo.PAGES[l].hreflang}" href="${pageUrl(seo, l, technique)}" />`,
        ),
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${pageUrl(seo, seo.DEFAULT_LANG, technique)}" />`,
      ].join('\n');
      return langs.map(
        (l) => `  <url>
    <loc>${pageUrl(seo, l, technique)}</loc>
    <lastmod>${lastmod}</lastmod>
${alternates}
  </url>`,
      );
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}

function listFilesRecursive(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    return fs.statSync(full).isDirectory() ? listFilesRecursive(full) : [full];
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

// Relative to sw.js, so the same worker works at / and under /<repo>/
const toUrl = (f) => path.relative(DIST, f).split(path.sep).join('/');

function generateServiceWorker() {
  const soundsDir = path.normalize(`${DIST}/assets/sounds`);
  const soundFiles = listFilesRecursive(soundsDir);
  // Every language page (index.html, en.html…) is part of the shell
  const pages = fs
    .readdirSync(DIST)
    .filter((f) => f.endsWith('.html'))
    .map((f) => `${DIST}/${f}`);
  const shellFiles = [
    ...pages,
    ...CSS_FILES.map((f) => `${DIST}/${f}`),
    `${DIST}/tutorial.js`,
    `${DIST}/manifest.json`,
    ...listFilesRecursive(`${DIST}/assets`).filter(
      (f) => !f.startsWith(soundsDir),
    ),
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

  // Calendar files for the daily reminder: straight to the network
  // (not precached, and they must not get the index.html fallback)
  if (request.url.startsWith(new URL('reminder/', self.registration.scope).href)) return;

  // Page navigations: serve that very page when it is cached (en.html and
  // any other language page), otherwise fall back to index.html — which is
  // what the app root and "?source=pwa" resolve to.
  if (request.mode === 'navigate') {
    event.respondWith(
      caches
        .match(request, { ignoreSearch: true })
        .then((cached) => cached || caches.match(new URL('index.html', self.registration.scope)))
        .then((cached) => cached || fetch(request))
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
