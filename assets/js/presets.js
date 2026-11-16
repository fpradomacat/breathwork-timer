// ── Breathing technique presets ───────────────────────────────
//
// Each preset defines:
//   nameEs / nameEn      — displayed name in the UI
//   tagEs  / tagEn       — short goal tag shown on the card
//   descEs / descEn      — description shown in the techniques modal
//   timing               — [inhale, holdFull, exhale, holdEmpty] in seconds
//   soundDir             — folder under /assets/sounds/ holding the layers:
//                            <dir>-breathing.mp3  phase cues (always on)
//                            <dir>-breaths.mp3    breathing sound
//                            <dir>-voice-es.mp3   voice guide, Spanish
//                            <dir>-voice-en.mp3   voice guide, English
//                          each exactly one cycle long (see loop.js)
//   helperCycles         — how many cycles the voice guides by default
//   autoLimitCycles      — (optional) auto-stops the session after N cycles

export const PRESETS = [
  {
    nameEs: 'Respiración cuadrada',
    nameEn: 'Box Breathing',
    tagEs: 'Equilibrio',
    tagEn: 'Balance',
    timing: [4, 4, 4, 4],
    soundDir: 'box',
    helperCycles: 3,
    descEs:
      'Inhala, retén, exhala, retén — 4 segundos cada paso. Calma la mente rápido.',
    descEn:
      'Inhale, hold, exhale, hold — 4 seconds each. Quickly calms the mind.',
  },
  {
    nameEs: 'Coherencia Cardíaca',
    nameEn: 'Cardiac Coherence',
    tagEs: 'Calma',
    tagEn: 'Calm',
    timing: [5, 0, 5, 0],
    soundDir: 'coherent',
    helperCycles: 3,
    descEs:
      '5 segundos adentro, 5 afuera. Sincroniza el corazón y la mente. Ideal para el día a día.',
    descEn:
      '5 seconds in, 5 out. Syncs heart and mind. Great for daily practice.',
  },
  {
    nameEs: '4-7-8 Relajante',
    nameEn: '4-7-8 Relaxing',
    tagEs: 'Sueño',
    tagEn: 'Sleep',
    timing: [4, 7, 8, 0],
    soundDir: '478',
    helperCycles: 3,
    descEs:
      'Inhala 4, retén 7, exhala 8. Reduce la ansiedad y ayuda a conciliar el sueño.',
    descEn:
      'Inhale 4, hold 7, exhale 8. Eases anxiety and helps you fall asleep.',
  },
  {
    nameEs: 'Fuego',
    nameEn: 'Fire Breath',
    tagEs: 'Energía',
    tagEn: 'Energy',
    timing: [1, 0, 1, 0],
    autoLimitCycles: 30,
    soundDir: 'fire',
    helperCycles: 5,
    descEs: 'Respiración rápida y rítmica para activarte. Máximo 30 ciclos.',
    descEn: 'Fast rhythmic breathing to energize you. Max 30 cycles.',
  },
];
