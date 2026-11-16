// ── Breathing tests: definitions + results ───────────────────
//
// Two short, at-rest tests to track progress over time:
//   - BOLT (control pause): after a normal exhale, how long until the
//     first clear urge to breathe. Not a maximum hold.
//   - Slow exhale: after a full inhale, how long one exhale can last.
// Neither involves hyperventilating first, so they're safe to repeat.
//
// Results stay on the device (localStorage "neyen.tests"):
//   [{ test: 'bolt' | 'exhale', secs, date (ISO) }]
//
// No DOM here (the modal is breath-tests.js), so it can be unit tested.
// Texts follow the presets.js convention: <field>Es / <field>En.

import { load, save } from './storage.js';

const KEY = 'tests';
const MAX_RESULTS = 200;

// bands: upper bound (exclusive, seconds) → label. Last one is open-ended.
export const TESTS = [
  {
    id: 'bolt',
    emoji: '⏸️',
    nameEs: 'Pausa de control (BOLT)',
    nameEn: 'Control pause (BOLT)',
    descEs:
      'Cuánto tardan en aparecer las ganas de respirar después de exhalar. Refleja tu tolerancia al CO₂ en reposo.',
    descEn:
      'How long until you feel the urge to breathe after exhaling. Reflects your CO₂ tolerance at rest.',
    stepsEs: [
      'Sentate derecho y respirá normal por la nariz durante un minuto.',
      'Después de una exhalación normal, sin forzar, tapate la nariz y tocá Empezar.',
      'Tocá Listo apenas sientas las primeras ganas claras de respirar. No se trata de aguantar al máximo.',
    ],
    stepsEn: [
      'Sit up straight and breathe normally through your nose for a minute.',
      'After a normal, relaxed exhale, pinch your nose and tap Start.',
      'Tap Done as soon as you feel the first clear urge to breathe. It is not a maximum hold.',
    ],
    runningEs: 'Tocá Listo con las primeras ganas de respirar',
    runningEn: 'Tap Done at the first urge to breathe',
    refEs: 'Referencia: 20 s o más está bien; 40 s o más es excelente.',
    refEn: 'Reference: 20 s or more is good; 40 s or more is excellent.',
    bands: [
      [10, 'Para trabajar', 'Room to grow'],
      [20, 'Mejorable', 'Fair'],
      [40, 'Bien', 'Good'],
      [Infinity, 'Excelente', 'Excellent'],
    ],
  },
  {
    id: 'exhale',
    emoji: '🌬️',
    nameEs: 'Exhalación lenta',
    nameEn: 'Slow exhale',
    descEs:
      'Cuánto podés estirar una sola exhalación. Mide tu control respiratorio y tu tolerancia al CO₂.',
    descEn:
      'How long you can stretch a single exhale. Measures breath control and CO₂ tolerance.',
    stepsEs: [
      'Sentate derecho y respirá tranquilo unas cuantas veces.',
      'Inhalá profundo por la nariz y tocá Empezar.',
      'Exhalá por la nariz, lo más lento y parejo que puedas.',
      'Tocá Listo cuando te quedes sin aire.',
    ],
    stepsEn: [
      'Sit up straight and take a few calm breaths.',
      'Inhale fully through your nose and tap Start.',
      'Exhale through your nose, as slowly and evenly as you can.',
      'Tap Done when you run out of air.',
    ],
    runningEs: 'Exhalá lento y parejo…',
    runningEn: 'Exhale slowly and evenly…',
    refEs: 'Referencia: 40 s o más está bien; 60 s o más es excelente.',
    refEn: 'Reference: 40 s or more is good; 60 s or more is excellent.',
    bands: [
      [20, 'Para trabajar', 'Room to grow'],
      [40, 'Mejorable', 'Fair'],
      [60, 'Bien', 'Good'],
      [Infinity, 'Excelente', 'Excellent'],
    ],
  },
];

/** Index of the band a result falls in (0 = lowest). */
export function bandIndex(test, secs) {
  return test.bands.findIndex(([max]) => secs < max);
}

// ── Results storage ───────────────────────────────────────────
function _all() {
  const list = load(KEY, []);
  return Array.isArray(list) ? list : [];
}

export function addResult(test, secs) {
  const list = _all();
  list.push({ test, secs, date: new Date().toISOString() });
  save(KEY, list.slice(-MAX_RESULTS));
}

/** Results of one test, most recent first. */
export function resultsOf(test) {
  return _all()
    .filter((r) => r.test === test)
    .reverse();
}
