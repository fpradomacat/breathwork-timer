// Unit tests for the layered audio scheduler (assets/js/loop.js),
// driven by the mock AudioContext clock.

import { test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { audioCtx, log } from './mock-audio.mjs';

// fetch → an "audio file" tagged with its name (the mock decode returns it as-is)
globalThis.fetch = async (src) => ({
  ok: true,
  arrayBuffer: async () => ({ tag: src.split('/').pop().replace('.mp3', '') }),
});

const L = await import('../assets/js/loop.js');

const BOX = { soundDir: 'box', helperCycles: 3 };
const T0 = 0.1;
const CYCLE = 16;

/** Advance the audio clock to `until` in 250 ms steps, running the scheduler. */
function runUntil(until, from = audioCtx.currentTime) {
  for (let t = from; t <= until; t += 0.25) {
    audioCtx.currentTime = t;
    mock.timers.tick(250);
  }
}
const starts = (tag) => log.filter((e) => e.tag === tag).map((e) => e.when);

beforeEach(async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  audioCtx.currentTime = 0;
  log.length = 0;
  L.setLayerEnabled('voice', true);
  L.setLayerEnabled('breaths', true);
  L.setLayerEnabled('ticks', false);
  await L.loadTechniqueLoops(BOX, 'es');
});

afterEach(() => {
  L.stopLoop();
  mock.timers.reset();
});

test('every cycle of every layer starts at t0 + n·cycle', () => {
  L.startLoop(T0, CYCLE);
  runUntil(70); // + 3 s look-ahead → cycles starting before 73 s
  assert.deepEqual(starts('box-breathing'), [0.1, 16.1, 32.1, 48.1, 64.1]);
  assert.deepEqual(starts('box-breaths'), [0.1, 16.1, 32.1, 48.1, 64.1]);
});

test('the voice guides only the first helperCycles cycles by default', () => {
  L.startLoop(T0, CYCLE);
  runUntil(70);
  assert.deepEqual(starts('box-voice-es'), [0.1, 16.1, 32.1]);
});

test('ticks are scheduled once per second, at whole seconds of the cycle', () => {
  L.startLoop(T0, CYCLE);
  runUntil(1);
  const ticks = starts('tick').filter((t) => t < T0 + CYCLE);
  assert.equal(ticks.length, 16);
  assert.deepEqual(ticks.slice(0, 3), [0.1, 1.1, 2.1]);
});

test('turning the voice on after the guided cycles keeps it on, starting mid-cycle', () => {
  L.startLoop(T0, CYCLE);
  runUntil(70);
  log.length = 0;
  L.setLayerEnabled('voice', false);
  L.setLayerEnabled('voice', true); // at t = 70, cycle 4 started at 64.1
  runUntil(100, 70);
  const voice = log.filter((e) => e.tag === 'box-voice-es');
  assert.deepEqual(voice[0], { ...voice[0], when: 70, offset: 5.9 });
  assert.deepEqual(
    voice.map((e) => e.when),
    [70, 80.1, 96.1],
  );
});

test('a language switch mid-session changes the voice from the next cycles', async () => {
  L.startLoop(T0, CYCLE);
  runUntil(5);
  await L.loadTechniqueLoops(BOX, 'en');
  log.length = 0;
  runUntil(30, 5);
  assert.ok(starts('box-voice-en').length > 0);
  assert.equal(starts('box-voice-es').length, 0);
});

test('a disabled layer is still scheduled, at zero gain (toggling is instant)', () => {
  L.setLayerEnabled('breaths', false);
  L.startLoop(T0, CYCLE);
  runUntil(1);
  const breaths = log.find((e) => e.tag === 'box-breaths');
  assert.ok(breaths);
  assert.equal(breaths.gain.gain.value, 0);
  L.setLayerEnabled('breaths', true);
  assert.equal(breaths.gain.gain.target, 0.55);
});

test('setLayerVolume scales the layer gain', () => {
  L.startLoop(T0, CYCLE);
  runUntil(1);
  const voice = log.find((e) => e.tag === 'box-voice-es');
  L.setLayerVolume('voice', 0.5);
  assert.equal(voice.gain.gain.target, 0.55 * 0.5);
  L.setLayerVolume('voice', 1);
});

test('stopLoop(fade) ramps every layer to 0 and nothing more gets scheduled', () => {
  L.startLoop(T0, CYCLE);
  runUntil(10);
  const gain = log.find((e) => e.tag === 'box-breathing').gain;
  L.stopLoop(1.5);
  assert.equal(gain.gain.target, 0);
  log.length = 0;
  runUntil(60, 10);
  assert.equal(log.length, 0);
});

test('fractional cycle lengths stay exact', () => {
  L.startLoop(T0, 10.5);
  runUntil(40); // + 3 s look-ahead → cycles starting before 43 s
  assert.deepEqual(starts('box-breathing'), [0.1, 10.6, 21.1, 31.6, 42.1]);
});
