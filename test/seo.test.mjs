// Consistency checks for the landing / SEO content (seo-content.js).
// It is the one place where prose lives outside i18n.js, and build.js
// turns it into static HTML and JSON-LD, so drift between languages
// would ship a half-translated page.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const {
  SEO,
  PAGES,
  DEFAULT_LANG,
  renderSeo,
  renderPage,
  faqItems,
  pageHref,
  pagePath,
  pageIds,
  pageMeta,
} = await import('../assets/js/seo-content.js');
const { PRESETS } = await import('../assets/js/presets.js');
const { i18n } = await import('../assets/js/i18n.js');

const LANGS = Object.keys(SEO);

test('every language in i18n has a page and SEO content, and vice versa', () => {
  assert.deepEqual(LANGS.sort(), Object.keys(i18n).sort());
  assert.deepEqual(Object.keys(PAGES).sort(), LANGS.sort());
  assert.ok(DEFAULT_LANG in PAGES);
});

test('every language has the same SEO keys, with the same kind of value', () => {
  const [base, ...others] = LANGS;
  for (const lang of others) {
    assert.deepEqual(
      Object.keys(SEO[lang]).sort(),
      Object.keys(SEO[base]).sort(),
      lang,
    );
    for (const key of Object.keys(SEO[base]))
      assert.equal(
        typeof SEO[lang][key],
        typeof SEO[base][key],
        `${lang}.${key}`,
      );
  }
});

test('titles and descriptions stay inside what search engines show', () => {
  for (const lang of LANGS) {
    assert.ok(SEO[lang].shareTitle.length > 0);
    for (const technique of pageIds()) {
      const { title, description } = pageMeta(lang, technique);
      const page = `${lang}/${technique || 'home'}`;
      assert.ok(title.length <= 70, `${page}: title ${title.length}`);
      assert.ok(title.length >= 20, `${page}: title too short`);
      assert.ok(
        description.length <= 165,
        `${page}: description ${description.length}`,
      );
      assert.ok(description.length >= 70, `${page}: description too short`);
    }
  }
  // Two pages competing for the same search result helps neither
  const titles = LANGS.flatMap((l) =>
    pageIds().map((t) => pageMeta(l, t).title),
  );
  assert.equal(new Set(titles).size, titles.length, 'duplicate page titles');
});

test('every page has its own flat file in the site root', () => {
  const paths = LANGS.flatMap((l) => pageIds().map((t) => pagePath(l, t)));
  assert.equal(new Set(paths).size, paths.length, 'two pages share a path');
  // Every runtime path is relative, so a page in a folder would resolve
  // assets/, sw.js and reminder/ one level too deep
  for (const p of paths.filter(Boolean))
    assert.match(p, /^[a-z0-9-]+\.html$/, p);
  assert.ok(!paths.includes('index.html'), 'index.html is the home page');
});

test('every technique page has FAQ entries, tagged the same in every language', () => {
  const dirs = PRESETS.map((p) => p.soundDir);
  for (const lang of LANGS)
    for (const { q, topics = [] } of SEO[lang].faq)
      for (const t of topics)
        assert.ok(dirs.includes(t), `${lang}: "${q}" → ${t}`);
  const [base, ...others] = LANGS;
  for (const lang of others)
    SEO[base].faq.forEach((item, i) =>
      assert.deepEqual(
        SEO[lang].faq[i].topics,
        item.topics,
        `${lang} faq #${i}`,
      ),
    );
  for (const lang of LANGS)
    for (const dir of dirs)
      assert.ok(faqItems(lang, dir).length >= 2, `${lang}/${dir}: too few FAQ`);
});

test('every preset has its how/when copy in every language', () => {
  for (const lang of LANGS)
    for (const p of PRESETS) {
      const extra = SEO[lang].techniques[p.soundDir];
      assert.ok(extra, `${lang}: no copy for ${p.soundDir}`);
      assert.ok(extra.how, `${lang}.${p.soundDir}.how`);
      assert.ok(extra.when, `${lang}.${p.soundDir}.when`);
    }
  // No leftovers for techniques that no longer exist
  const dirs = PRESETS.map((p) => p.soundDir);
  for (const lang of LANGS)
    for (const key of Object.keys(SEO[lang].techniques))
      assert.ok(dirs.includes(key), `${lang}: stale technique copy ${key}`);
});

test('the FAQ is the same size in every language and has plain-text answers', () => {
  const sizes = LANGS.map((l) => faqItems(l).length);
  assert.ok(sizes[0] >= 8, 'too few FAQ entries to be worth the markup');
  assert.equal(new Set(sizes).size, 1, 'FAQ length differs between languages');
  for (const lang of LANGS)
    for (const { q, a } of faqItems(lang)) {
      assert.ok(q.endsWith('?'), `${lang}: "${q}" is not a question`);
      // Answers go verbatim into the JSON-LD, which takes no markup
      assert.ok(!/[<>]/.test(a), `${lang}: markup in the answer to "${q}"`);
      assert.ok(a.length > 40, `${lang}: answer to "${q}" is too thin`);
    }
});

/** Every anchor points somewhere real and opens safely. */
function assertLinks(html, where) {
  for (const tag of html.match(/<a [^>]*>/g) || []) {
    assert.ok(
      /href="https?:\/\/|href="\.?\/|href="[a-z0-9-]+\.html"|href="#[a-z-]+"|href="mailto:[^"@]+@[^"]+"/.test(
        tag,
      ),
      `${where}: ${tag}`,
    );
    if (tag.includes('target="_blank"'))
      assert.ok(tag.includes('rel="noopener"'), `missing rel: ${tag}`);
  }
  assert.ok(!html.includes('undefined'), `${where}: undefined in output`);
}

test('renderSeo produces balanced sections and links the other pages', () => {
  for (const lang of LANGS) {
    const html = renderSeo(lang);
    const other = lang === 'es' ? 'en' : 'es';
    // One <h2> per section, one <details> per FAQ entry
    assert.equal((html.match(/<h2>/g) || []).length, 5, `${lang}: h2 count`);
    assert.equal(
      (html.match(/<details/g) || []).length,
      faqItems(lang).length,
      `${lang}: details count`,
    );
    assert.equal(
      (html.match(/<h3>/g) || []).length,
      PRESETS.length,
      `${lang}: technique count`,
    );
    // Links to other pages only exist on a built site
    assert.ok(!html.includes('seo-altlang'), `${lang}: unexpected lang link`);
    assert.ok(!html.includes('.html"'), `${lang}: unexpected page link`);
    const built = renderSeo(lang, { built: true });
    assert.ok(
      built.includes(`href="${pageHref(other)}"`),
      `${lang}: missing link to ${other}`,
    );
    for (const p of PRESETS)
      assert.ok(
        built.includes(`href="${pageHref(lang, p.soundDir)}"`),
        `${lang}: no link to the ${p.soundDir} page`,
      );
    assertLinks(html, lang);
    assertLinks(built, lang);
  }
});

test('a technique page is about that technique and links every other page', () => {
  for (const lang of LANGS)
    for (const p of PRESETS) {
      const where = `${lang}/${p.soundDir}`;
      const html = renderPage(lang, p.soundDir, { built: true });
      const other = lang === 'es' ? 'en' : 'es';
      assert.ok(html.includes(SEO[lang].techniques[p.soundDir].how), where);
      assert.ok(html.includes(SEO[lang].techniques[p.soundDir].when), where);
      if (p.warnEs)
        assert.ok(html.includes('seo-warn'), `${where}: no warning`);
      assert.equal(
        (html.match(/<details/g) || []).length,
        faqItems(lang, p.soundDir).length,
        `${where}: details count`,
      );
      // Same technique in the other language, the other techniques, home
      for (const href of [
        pageHref(other, p.soundDir),
        pageHref(lang, null),
        ...PRESETS.filter((o) => o !== p).map((o) =>
          pageHref(lang, o.soundDir),
        ),
      ])
        assert.ok(
          html.includes(`href="${href}"`),
          `${where}: no link to ${href}`,
        );
      assert.ok(
        !html.includes(`href="${pageHref(lang, p.soundDir)}"`),
        `${where}: links itself`,
      );
      assertLinks(html, where);
    }
});

test('index.html carries the markers build.js needs to make each page', () => {
  const html = fs.readFileSync(
    new URL('../index.html', import.meta.url),
    'utf8',
  );
  for (const marker of [
    '<html lang="es">',
    '<!-- SEO-HEAD -->',
    'id="lang-btn"',
  ])
    assert.equal(
      html.split(marker).length - 1,
      1,
      `index.html: "${marker}" must appear exactly once`,
    );
  assert.match(html, /<section class="seo" id="info">\s*<\/section>/);
  // build.js finds these by pattern and swaps them per language: a second
  // mention anywhere — a comment included — would make it rewrite the
  // wrong span of the file
  assert.equal(html.split('<title').length - 1, 1, 'one title tag');
  assert.equal(html.split('</title>').length - 1, 1, 'one closing title tag');
  assert.equal(
    html.split('name="description"').length - 1,
    1,
    'one description meta',
  );
  assert.match(html, /<meta\s+name="description"[\s\S]*?\/>/);
});
