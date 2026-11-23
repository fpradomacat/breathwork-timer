// Consistency checks for the landing / SEO content (seo-content.js).
// It is the one place where prose lives outside i18n.js, and build.js
// turns it into static HTML and JSON-LD, so drift between languages
// would ship a half-translated page.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { SEO, PAGES, DEFAULT_LANG, renderSeo, faqItems, pageHref } =
  await import('../assets/js/seo-content.js');
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
    const { metaTitle, metaDescription, shareTitle } = SEO[lang];
    assert.ok(metaTitle.length <= 70, `${lang}: title ${metaTitle.length}`);
    assert.ok(metaTitle.length >= 20, `${lang}: title too short`);
    assert.ok(
      metaDescription.length <= 165,
      `${lang}: description ${metaDescription.length}`,
    );
    assert.ok(metaDescription.length >= 70, `${lang}: description too short`);
    assert.ok(shareTitle.length > 0);
  }
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

test('renderSeo produces balanced sections and links the other language', () => {
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
    // The language link only exists on a built site
    assert.ok(!html.includes('seo-altlang'), `${lang}: unexpected lang link`);
    assert.ok(
      renderSeo(lang, { linkAlternate: true }).includes(
        `href="${pageHref(other)}"`,
      ),
      `${lang}: missing link to ${other}`,
    );
    // Every anchor opens safely and nothing is left half-written
    for (const tag of html.match(/<a [^>]*>/g) || []) {
      assert.ok(
        /href="https?:\/\/|href="\.?\/|href="[a-z0-9-]+\.html/.test(tag),
        tag,
      );
      if (tag.includes('target="_blank"'))
        assert.ok(tag.includes('rel="noopener"'), `missing rel: ${tag}`);
    }
    assert.ok(!html.includes('undefined'), `${lang}: undefined in output`);
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
