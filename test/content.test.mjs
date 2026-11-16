// Consistency checks for translations and presets.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const { i18n } = await import('../assets/js/i18n.js');
const { PRESETS, GOALS } = await import('../assets/js/presets.js');
const { TESTS } = await import('../assets/js/breath-test-data.js');

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
    for (const f of ['name', 'desc'])
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

test('every goal has a technique and an i18n label; every preset has a goal', () => {
  for (const g of GOALS) {
    assert.ok(
      PRESETS.some((p) => p.goal === g.id),
      `goal ${g.id} has no preset`,
    );
    assert.equal(typeof i18n.es[g.label], 'string', g.label);
  }
  for (const p of PRESETS)
    assert.ok(
      GOALS.some((g) => g.id === p.goal),
      `${p.soundDir}: goal "${p.goal}"`,
    );
});

test('every breathing test is complete and bilingual', () => {
  for (const t of TESTS) {
    for (const f of ['name', 'desc', 'running', 'ref'])
      assert.ok(t[f + 'Es'] && t[f + 'En'], `${t.id}: ${f}`);
    assert.equal(t.stepsEs.length, t.stepsEn.length, `${t.id}: steps`);
    assert.equal(t.bands.at(-1)[0], Infinity, `${t.id}: last band open`);
    for (const b of t.bands) assert.ok(b[1] && b[2], `${t.id}: band labels`);
  }
});
