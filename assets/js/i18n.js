// ── Translations ──────────────────────────────────────────────
// Add a new language by adding a key here that matches the lang codes
// used in applyLang(). All keys must be present in every language.

export const i18n = {
  es: {
    title: 'Neyen | el arte de respirar',
    statSession: 'Sesión',
    statCycles: 'Ciclos',
    statLast: 'Última',
    ready: 'Listo',
    inhaling: 'Inhala',
    holding: 'Mantén',
    exhaling: 'Exhala',
    menuPresets: 'Técnicas',
    buymeacoffee: 'Invitame un café',
    soundMusic: 'Música ambiente',
    soundVoice: 'Voz guía',
    soundBreaths: 'Sonido de respiración',
    soundTicks: 'Segundos',

    // Functions for dynamic strings
    limitMsg: (type, val) =>
      type === 'minutes'
        ? `⏱ ${val} min alcanzados`
        : `🔄 ${val} ciclos completados`,
    limitBadgeMin: (val) => `⏱ ${val} min`,
    limitBadgeCyc: (val) => `🔄 ${val} ciclos`,
    fireBreathAutoLimit: (n) => `límite automático: ${n} ciclos`,
  },

  en: {
    title: 'Neyen | the art of breathing',
    statSession: 'Session',
    statCycles: 'Cycles',
    statLast: 'Last',
    ready: 'Ready',
    inhaling: 'Inhale',
    holding: 'Hold',
    exhaling: 'Exhale',
    menuPresets: 'Techniques',
    buymeacoffee: 'Buy me a coffee',
    soundMusic: 'Ambient music',
    soundVoice: 'Voice guide',
    soundBreaths: 'Breathing sound',
    soundTicks: 'Second ticks',

    limitMsg: (type, val) =>
      type === 'minutes'
        ? `⏱ ${val} min reached`
        : `🔄 ${val} cycles completed`,
    limitBadgeMin: (val) => `⏱ ${val} min`,
    limitBadgeCyc: (val) => `🔄 ${val} cycles`,
    fireBreathAutoLimit: (n) => `auto-limit: ${n} cycles`,
  },
};
