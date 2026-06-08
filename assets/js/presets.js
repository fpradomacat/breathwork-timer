// ── Breathing technique presets ───────────────────────────────
//
// Each preset defines:
//   nameEs / nameEn      — displayed name in the UI
//   tagEs  / tagEn       — short goal tag shown on the card
//   descEs / descEn      — description shown in the techniques modal
//   timing               — [inhale, holdFull, exhale, holdEmpty] in seconds
//   soundFile            — base loop (no voice cues)
//   soundFileEs          — voiced loop in Spanish
//   soundFileEn          — voiced loop in English
//   helperCycles         — how many cycles the voiced version plays before
//                          switching to the clean base loop
//   autoLimitCycles      — (optional) auto-stops the session after N cycles

export const PRESETS = [
  {
    nameEs: 'Respiración cuadrada',
    nameEn: 'Box Breathing',
    tagEs: 'Equilibrio',
    tagEn: 'Balance',
    timing: [4, 4, 4, 4],
    soundFile: 'assets/sounds/box-breathing.mp3',
    soundFileEs: 'assets/sounds/box-breathing-helper-es.mp3',
    soundFileEn: 'assets/sounds/box-breathing-helper-en.mp3',
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
    soundFile: 'assets/sounds/coherence-breathing.mp3',
    soundFileEs: 'assets/sounds/coherence-breathing-helper-es.mp3',
    soundFileEn: 'assets/sounds/coherence-breathing-helper-en.mp3',
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
    soundFile: 'assets/sounds/478-breathing.mp3',
    soundFileEs: 'assets/sounds/478-breathing-helper-es.mp3',
    soundFileEn: 'assets/sounds/478-breathing-helper-en.mp3',
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
    soundFile: 'assets/sounds/fire-breath.mp3',
    soundFileEs: 'assets/sounds/fire-breath-helper-es.mp3',
    soundFileEn: 'assets/sounds/fire-breath-helper-en.mp3',
    helperCycles: 5,
    descEs: 'Respiración rápida y rítmica para activarte. Máximo 30 ciclos.',
    descEn: 'Fast rhythmic breathing to energize you. Max 30 cycles.',
  },
];
