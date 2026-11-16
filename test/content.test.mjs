// Consistency checks for translations and presets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { i18n } = await import('../assets/js/i18n.js');
const { PRESETS } = await import('../assets/js/presets.js');

const SOUNDS = new URL('../assets/sounds/', import.meta.url);

test('every language has the same keys, with the same kind of value', () => {
  const [base, ...others] = Object.keys(i18n);
  for (const lang of others) {
    assert.deepEqual(
      Object.keys(i18n[lang]).sort(),
      Object.keys(i18n[base]).sort(),
      lang,
    );
    for (const key of Object.keys(i18n[base]))
      assert.equal(
        typeof i18n[lang][key],
        typeof i18n[base][key],
        `${lang}.${key}`,
      );
  }
});

test('every data-i18n / data-i18n-label key used in index.html exists', () => {
  const html = fs.readFileSync(
    new URL('../index.html', import.meta.url),
    'utf8',
  );
  const keys = [...html.matchAll(/data-i18n(?:-label)?="([^"]+)"/g)].map(
    (m) => m[1],
  );
  assert.ok(keys.length > 10);
  for (const key of keys) assert.equal(typeof i18n.es[key], 'string', key);
});

test('every preset is complete and bilingual', () => {
  for (const p of PRESETS) {
    for (const f of ['name', 'tag', 'desc'])
      assert.ok(p[f + 'Es'] && p[f + 'En'], `${p.soundDir}: ${f}Es/${f}En`);
    assert.equal(
      Boolean(p.warnEs),
      Boolean(p.warnEn),
      `${p.soundDir}: warnEs/warnEn`,
    );
    assert.equal(p.timing.length, 4);
    assert.ok(p.timing.every((t) => typeof t === 'number' && t >= 0));
    assert.ok(p.timing.reduce((a, b) => a + b) > 0);
    assert.ok(p.helperCycles >= 0);
  }
});

test('every preset has its 4 sound layers on disk', () => {
  for (const { soundDir: d } of PRESETS)
    for (const layer of ['breathing', 'breaths', 'voice-es', 'voice-en'])
      assert.ok(
        fs.existsSync(new URL(`${d}/${d}-${layer}.mp3`, SOUNDS)),
        `${d}-${layer}.mp3`,
      );
});

test('preset sound folders are unique (used as history ids)', () => {
  const dirs = PRESETS.map((p) => p.soundDir);
  assert.equal(new Set(dirs).size, dirs.length);
});
