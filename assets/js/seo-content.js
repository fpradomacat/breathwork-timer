// ── SEO / landing content ─────────────────────────────────────
//
// The prose that lives under the app: what Neyen is, how each technique
// works, a FAQ and who is behind it. It exists so that search engines
// (and people who scroll) find real text in the page instead of an empty
// shell rendered by JS.
//
// Single source of truth, used twice:
//   - build.js renders it into static HTML for each language page
//     (dist/index.html = es, dist/en.html = en) and into the FAQPage
//     JSON-LD, so crawlers see it without running any script.
//   - ui.js re-renders it on language change, and fills it in when it is
//     empty (serving the repo root in development, where no build ran).
//
// This module must stay DOM-free: build.js imports it in Node.
//
// Content strings are trusted, hand-written HTML: `intro`, `about` and
// `technique` fields may contain inline tags (<a>, <strong>, <em>).
// FAQ answers are plain text on purpose — they are copied verbatim into
// the JSON-LD, which must match what the page shows.

import { PRESETS } from './presets.js';

// Where each language is published, relative to the site root.
// Used for canonical / hreflang (build.js) and the in-page language link.
export const PAGES = {
  es: { path: '', htmlLang: 'es', hreflang: 'es', ogLocale: 'es_AR' },
  en: { path: 'en.html', htmlLang: 'en', hreflang: 'en', ogLocale: 'en_US' },
};

// The language Google serves when none of the hreflang values match
export const DEFAULT_LANG = 'es';

export const AUTHOR = {
  name: 'Federico Prado',
  instagram: 'https://instagram.com/soypradito',
  youtube: 'https://www.youtube.com/@meditawork',
  coffee: 'https://buymeacoffee.com/soypradito',
};

export const SEO = {
  es: {
    // <title> and <meta name="description">. Keep the title under ~60
    // characters and the description under ~155 so they aren't cut off.
    metaTitle:
      'Neyen · Respiración guiada gratis: 4-7-8, cuadrada y coherencia',
    metaDescription:
      'Temporizador de respiración guiada con voz y sonido: 4-7-8 para dormir, respiración cuadrada para el foco, coherencia cardíaca para calmarte. Gratis, sin registro.',
    // Link previews (WhatsApp, Telegram, LinkedIn): the brand reads
    // better than the keyword-heavy <title> when it's shared
    shareTitle: 'Neyen · el arte de respirar',

    introHeading: '¿Qué es Neyen?',
    intro: [
      'Neyen es un <strong>temporizador de respiración guiada</strong> que corre en el navegador. Elegís qué necesitás —calma, sueño, foco o energía—, tocás el círculo y te vas dejando llevar: el círculo se expande y se contrae con cada fase, una voz te acompaña los primeros ciclos y el sonido marca el ritmo para que no tengas que contar.',
      'Es gratis, no pide registro ni correo, no tiene anuncios y <strong>funciona sin internet</strong>: se puede instalar en el celular como una app y después abrir en modo avión. Lo que practicás queda guardado en tu dispositivo, no en un servidor.',
      '«Neyen» significa fuerza o energía vital en mapudungun, la lengua del pueblo mapuche.',
    ],

    techniquesHeading: 'Las técnicas de respiración',
    techniquesIntro:
      'Cuatro técnicas, cada una con su ritmo, su voz guía en español y su sonido de respiración. Los números son los segundos de cada fase: inhalar, retener con los pulmones llenos, exhalar y retener vacío.',
    techniques: {
      box: {
        how: 'Inhalá por la nariz contando cuatro, sostené el aire cuatro, exhalá cuatro y quedate con los pulmones vacíos otros cuatro. Lo que ordena es el ritmo parejo, no la cantidad de aire: no hace falta llenarse al máximo.',
        when: 'Antes de una reunión, de un examen o cuando la cabeza se va a mil. Es discreta y se puede hacer sentado en cualquier parte, por eso la usan deportistas, músicos y personal militar.',
      },
      coherent: {
        how: 'Cinco segundos adentro y cinco afuera, sin retenciones. Son seis respiraciones por minuto, el ritmo que suele asociarse a una mayor variabilidad de la frecuencia cardíaca.',
        when: 'Es la más suave y la más fácil de sostener en el tiempo: cinco minutos, dos o tres veces al día. Si nunca hiciste respiración consciente, empezá por acá.',
      },
      478: {
        how: 'Inhalá cuatro segundos por la nariz, sostené siete y exhalá ocho por la boca, de a poco, como soplando una vela sin apagarla. La exhalación larga es la parte que afloja: si te cuesta llegar, acortá los tres números manteniendo la proporción (por ejemplo 2-3,5-4).',
        when: 'De noche, ya acostado y con la luz apagada, o cuando necesitás bajar un pico de nervios. Cuatro a ocho ciclos suelen ser suficientes.',
      },
      fire: {
        how: 'Respiración rápida y rítmica por la nariz, un segundo adentro y uno afuera, con el abdomen activo y los hombros quietos. Neyen la corta sola a los treinta ciclos y después te deja unos segundos para respirar normal y registrar cómo quedaste.',
        when: 'A la mañana temprano o a media tarde, cuando el cuerpo pide movimiento y no hay café que alcance. No es una técnica para calmarse ni para hacer antes de dormir.',
      },
    },

    faqHeading: 'Preguntas frecuentes',
    faq: [
      {
        q: '¿Qué es la respiración consciente o breathwork?',
        a: 'Es el uso deliberado del ritmo de la respiración para cambiar cómo te sentís. Respirar lento y exhalar largo tiende a acompañar estados de calma; respirar rápido tiende a activar. Lo que hacen las técnicas es darte un ritmo concreto y sostenido en vez de dejarlo al azar, y un temporizador existe justamente para que no tengas que contar mientras practicás.',
      },
      {
        q: '¿Cuál es la mejor técnica para la ansiedad o los nervios?',
        a: 'Para el día a día, la coherencia cardíaca (5-5): es suave, no tiene retenciones y se puede repetir varias veces al día. Si lo que querés es bajar un pico puntual, la 4-7-8 o la respiración cuadrada suelen funcionar más rápido porque la exhalación es más larga que la inhalación. Probá las tres y quedate con la que te resulte más cómoda: la mejor técnica es la que realmente vas a practicar.',
      },
      {
        q: '¿Qué respiración ayuda a dormir?',
        a: 'La 4-7-8 es la más usada para eso: inhalar cuatro segundos, sostener siete y exhalar ocho. Conviene hacerla ya acostado, sin pantallas, y dejar que el cuerpo siga respirando tranquilo después de los últimos ciclos. Si las retenciones de siete segundos te incomodan, acortá los números manteniendo la proporción.',
      },
      {
        q: '¿Cómo funciona la respiración 4-7-8?',
        a: 'Es una secuencia de tres tiempos: inhalás por la nariz durante cuatro segundos, retenés el aire siete y exhalás por la boca durante ocho. La popularizó el médico Andrew Weil. La idea es que la exhalación dure el doble que la inhalación: alargar la exhalación es lo que más se asocia con la respuesta de relajación del cuerpo.',
      },
      {
        q: '¿Qué es la respiración cuadrada o box breathing?',
        a: 'Cuatro fases iguales de cuatro segundos: inhalar, retener con los pulmones llenos, exhalar y retener vacío. Se llama cuadrada porque los cuatro lados miden lo mismo. Sirve para ordenar la atención antes de algo que requiere foco, y es fácil de recordar porque es un solo número.',
      },
      {
        q: '¿Qué es la coherencia cardíaca?',
        a: 'Respirar a unas seis veces por minuto —cinco segundos adentro, cinco afuera— sin retener el aire. A ese ritmo el pulso se acelera y se desacelera de forma más regular con cada respiración. Es la técnica más fácil de sostener como hábito diario porque no marea y no exige nada.',
      },
      {
        q: '¿La respiración de fuego es segura?',
        a: 'Es la más intensa de las cuatro y puede dar mareo, hormigueo en las manos o en la cara. No la practiques manejando, en el agua, durante el embarazo, ni si tenés problemas cardíacos o respiratorios, presión alta o epilepsia. Hacela siempre sentado y, si te mareás, pará y volvé a respirar normal. Neyen la limita sola a treinta ciclos por ese motivo.',
      },
      {
        q: '¿Cuánto tiempo tengo que practicar para notar algo?',
        a: 'El efecto inmediato de una sesión —el cuerpo más suelto, la cabeza menos acelerada— suele aparecer a los tres o cinco minutos. El cambio de fondo, en cómo reaccionás al estrés en general, tiene más que ver con la constancia: cinco minutos todos los días rinden mucho más que media hora una vez por semana. Neyen guarda una racha de días justamente para eso.',
      },
      {
        q: '¿Hay que respirar por la nariz o por la boca?',
        a: 'Por la nariz como regla general: filtra, humedece el aire y hace que la inhalación sea más lenta y pareja. La excepción clásica es la 4-7-8, donde la exhalación es por la boca con los labios entrecerrados para poder alargarla. Si tenés la nariz tapada, respirá como puedas: forzar no ayuda.',
      },
      {
        q: '¿Cada cuánto conviene practicar?',
        a: 'Una o dos veces por día alcanza para armar el hábito, y lo más fácil es colgarlo de algo que ya hacés: al despertar, antes de almorzar, al apagar la computadora. Neyen te deja agregar un recordatorio diario a tu calendario para no depender de acordarte.',
      },
      {
        q: '¿Qué es el test BOLT o la pausa de control?',
        a: 'Es una medida sencilla de cuánto tolerás el dióxido de carbono: después de una exhalación normal, cronometrás hasta el primer impulso claro de volver a respirar, sin forzar nada. Interesa menos el número en sí que cómo se mueve con las semanas. Neyen lo incluye junto a un test de exhalación lenta, y guarda los resultados en tu dispositivo.',
      },
      {
        q: '¿Hace falta registrarse o pagar?',
        a: 'No. No hay cuenta, ni correo, ni versión premium, ni anuncios. Si te resulta útil podés invitarme un café, pero la app entera está disponible sin eso.',
      },
      {
        q: '¿Funciona sin internet? ¿Puedo instalarla en el celular?',
        a: 'Sí a las dos. Es una aplicación web progresiva: al abrirla descarga todo, incluidos los sonidos, así que después funciona en modo avión. Desde el navegador del celular podés elegir «Agregar a la pantalla de inicio» y queda como una app más, a pantalla completa.',
      },
      {
        q: '¿Dónde se guardan mis sesiones y mis datos?',
        a: 'En tu propio navegador, en el almacenamiento local del dispositivo. Neyen no tiene servidor ni base de datos: no hay cuentas, no se envía nada a ninguna parte y no hay seguimiento. Si borrás los datos del sitio, se borra también tu historial.',
      },
      {
        q: '¿Puedo usar estas técnicas si tengo alguna condición médica?',
        a: 'Las técnicas suaves y sin retenciones, como la coherencia cardíaca, son tranquilas para la mayoría de las personas. Las que incluyen retenciones largas o respiración rápida no son para todo el mundo: si estás embarazada, tenés problemas cardíacos o respiratorios, presión alta, epilepsia, glaucoma o un trastorno de pánico, consultá antes con un profesional de la salud. Y si en cualquier momento te mareás, se te duerme la cara o algo se siente mal, pará y respirá normal.',
      },
    ],

    aboutHeading: 'Quién está detrás',
    about: [
      'Soy Fede. Practico respiración consciente todos los días desde hace meses, estoy cursando una certificación de breathwork y grabo meditaciones y sesiones de respiración guiada en español en mi canal de YouTube, <a href="https://www.youtube.com/@meditawork" target="_blank" rel="noopener">@meditawork</a>.',
      'Hice Neyen porque quería practicar con un ritmo exacto y sin que una app me pidiera una cuenta, me mostrara un anuncio o me cobrara una suscripción para destrabar la técnica siguiente. Soy programador, así que me lo armé. Está acá por si a vos también te sirve.',
      'Si querés contarme cómo te va, escribime a <a href="https://instagram.com/soypradito" target="_blank" rel="noopener">@soypradito</a> en Instagram. Las sugerencias y los errores que reportan son, literalmente, de dónde salen las versiones nuevas.',
    ],

    disclaimerHeading: 'Antes de practicar',
    disclaimer:
      'Neyen es una herramienta de práctica, no un tratamiento ni un consejo médico. No reemplaza la consulta con un profesional de la salud. No la uses manejando, en el agua ni en ninguna situación donde marearte sea un riesgo, y si tenés una condición médica o estás embarazada, preguntá antes.',

    altLang: 'Read this page in English',
  },

  en: {
    metaTitle: 'Neyen · Free guided breathing timer: 4-7-8, box, coherent',
    metaDescription:
      'Guided breathing timer with voice and sound: 4-7-8 to fall asleep, box breathing to focus, cardiac coherence to calm down. Free, no sign-up, works offline.',
    shareTitle: 'Neyen · the art of breathing',

    introHeading: 'What is Neyen?',
    intro: [
      'Neyen is a <strong>guided breathing timer</strong> that runs in your browser. You pick what you need —calm, sleep, focus or energy—, tap the circle and follow along: the circle expands and contracts with every phase, a voice guides you through the first cycles and the sound keeps the rhythm, so you never have to count.',
      "It is free, asks for no account and no email, has no ads and <strong>works offline</strong>: you can install it on your phone like an app and open it in airplane mode. Whatever you practise stays on your device, not on anyone's server.",
      '“Neyen” means strength or life force in Mapudungun, the language of the Mapuche people.',
    ],

    techniquesHeading: 'The breathing techniques',
    techniquesIntro:
      'Four techniques, each with its own rhythm, an English voice guide and a breathing sound. The numbers are the seconds of each phase: inhale, hold with full lungs, exhale, hold empty.',
    techniques: {
      box: {
        how: 'Inhale through your nose for a count of four, hold for four, exhale for four, then stay empty for another four. What settles you is the even rhythm, not the amount of air — there is no need to fill up completely.',
        when: 'Before a meeting, before an exam, or whenever your head is racing. It is discreet and can be done sitting anywhere, which is why athletes, musicians and military personnel use it.',
      },
      coherent: {
        how: 'Five seconds in, five seconds out, no holds. That is six breaths per minute, the pace usually associated with greater heart-rate variability.',
        when: 'The gentlest one and the easiest to keep up: five minutes, two or three times a day. If you have never practised conscious breathing, start here.',
      },
      478: {
        how: 'Inhale through your nose for four seconds, hold for seven, then exhale through your mouth for eight, slowly, as if blowing at a candle without putting it out. The long exhale is what loosens you up: if eight seconds feels like too much, shorten all three numbers and keep the ratio (2-3.5-4, for instance).',
        when: 'At night, already lying down with the lights off, or when you need to come down from a spike of nerves. Four to eight cycles are usually enough.',
      },
      fire: {
        how: 'Fast, rhythmic breathing through the nose, one second in and one second out, with an active belly and still shoulders. Neyen stops it on its own after thirty cycles and then leaves you a few seconds to breathe normally and notice how you feel.',
        when: 'Early in the morning or mid-afternoon, when your body is asking for movement and no amount of coffee helps. It is not a technique for calming down, and not one to do before bed.',
      },
    },

    faqHeading: 'Frequently asked questions',
    faq: [
      {
        q: 'What is conscious breathing or breathwork?',
        a: 'It is the deliberate use of your breathing rhythm to change how you feel. Breathing slowly with a long exhale tends to go with calmer states; breathing fast tends to activate. What the techniques do is give you a specific, sustained rhythm instead of leaving it to chance, and a timer exists precisely so you do not have to count while you practise.',
      },
      {
        q: 'Which technique is best for anxiety or nerves?',
        a: 'For everyday use, cardiac coherence (5-5): it is gentle, has no holds and can be repeated several times a day. If you need to come down from a specific spike, 4-7-8 or box breathing usually work faster because the exhale is longer than the inhale. Try all three and keep the one that feels most comfortable — the best technique is the one you will actually practise.',
      },
      {
        q: 'Which breathing exercise helps you sleep?',
        a: 'The 4-7-8 is the one most used for that: inhale for four seconds, hold for seven, exhale for eight. Do it lying down, away from screens, and let your body keep breathing quietly after the last cycles. If holding for seven seconds feels uncomfortable, shorten the numbers and keep the ratio.',
      },
      {
        q: 'How does 4-7-8 breathing work?',
        a: 'It is a three-part sequence: you inhale through the nose for four seconds, hold the air for seven and exhale through the mouth for eight. It was popularised by Dr Andrew Weil. The point is that the exhale lasts twice as long as the inhale: lengthening the exhale is what is most associated with the body’s relaxation response.',
      },
      {
        q: 'What is box breathing?',
        a: 'Four equal phases of four seconds: inhale, hold with full lungs, exhale, hold empty. It is called box breathing because all four sides are the same length. It helps gather your attention before something that needs focus, and it is easy to remember because there is only one number.',
      },
      {
        q: 'What is cardiac coherence?',
        a: 'Breathing about six times a minute —five seconds in, five seconds out— without holding the air. At that pace your pulse speeds up and slows down more regularly with each breath. It is the easiest technique to keep as a daily habit because it does not make you dizzy and demands nothing.',
      },
      {
        q: 'Is fire breath safe?',
        a: 'It is the most intense of the four and can cause dizziness or tingling in your hands or face. Do not practise it while driving, in water, during pregnancy, or if you have heart or breathing problems, high blood pressure or epilepsy. Always do it sitting down, and if you feel dizzy, stop and go back to normal breathing. That is why Neyen caps it at thirty cycles.',
      },
      {
        q: 'How long until I notice something?',
        a: 'The immediate effect of a session —a looser body, a less frantic head— usually shows up after three to five minutes. The deeper change, in how you react to stress in general, has more to do with consistency: five minutes every day does far more than half an hour once a week. That is exactly why Neyen keeps a day streak.',
      },
      {
        q: 'Should I breathe through my nose or my mouth?',
        a: 'Through the nose as a general rule: it filters and humidifies the air and makes the inhale slower and smoother. The classic exception is 4-7-8, where you exhale through the mouth with pursed lips so you can stretch it out. If your nose is blocked, breathe however you can — forcing it does not help.',
      },
      {
        q: 'How often should I practise?',
        a: 'Once or twice a day is enough to build the habit, and the easiest way is to hang it off something you already do: waking up, before lunch, shutting the laptop. Neyen can add a daily reminder to your calendar so you do not have to rely on remembering.',
      },
      {
        q: 'What is the BOLT score or control pause?',
        a: 'It is a simple measure of how well you tolerate carbon dioxide: after a normal exhale, you time yourself until the first clear urge to breathe again, without forcing anything. The number itself matters less than how it moves over the weeks. Neyen includes it alongside a slow-exhale test, and keeps the results on your device.',
      },
      {
        q: 'Do I need to sign up or pay?',
        a: 'No. There is no account, no email, no premium tier and no ads. You can buy me a coffee if you find it useful, but the whole app is there without that.',
      },
      {
        q: 'Does it work offline? Can I install it on my phone?',
        a: 'Yes to both. It is a progressive web app: the first time you open it, it downloads everything, sounds included, so it then works in airplane mode. From your phone browser you can choose “Add to Home Screen” and it behaves like any other app, full screen.',
      },
      {
        q: 'Where are my sessions and my data stored?',
        a: 'In your own browser, in your device’s local storage. Neyen has no server and no database: there are no accounts, nothing is sent anywhere and there is no tracking. If you clear the site data, your history goes with it.',
      },
      {
        q: 'Can I use these techniques if I have a medical condition?',
        a: 'Gentle techniques with no holds, such as cardiac coherence, are calm enough for most people. The ones with long holds or fast breathing are not for everyone: if you are pregnant, or have heart or breathing problems, high blood pressure, epilepsy, glaucoma or a panic disorder, check with a health professional first. And if at any point you feel dizzy or something feels wrong, stop and breathe normally.',
      },
    ],

    aboutHeading: 'Who is behind this',
    about: [
      'I am Fede. I have been practising conscious breathing every day for months, I am currently taking a breathwork certification, and I record guided meditations and breathing sessions in Spanish on my YouTube channel, <a href="https://www.youtube.com/@meditawork" target="_blank" rel="noopener">@meditawork</a>.',
      'I built Neyen because I wanted to practise on an exact rhythm without an app asking me for an account, showing me an ad or charging a subscription to unlock the next technique. I am a developer, so I made my own. It is here in case it is useful to you too.',
      'If you want to tell me how it goes, write to <a href="https://instagram.com/soypradito" target="_blank" rel="noopener">@soypradito</a> on Instagram. Suggestions and bug reports are, literally, where new versions come from.',
    ],

    disclaimerHeading: 'Before you practise',
    disclaimer:
      'Neyen is a practice tool, not a treatment and not medical advice. It does not replace a consultation with a health professional. Do not use it while driving, in water, or in any situation where feeling dizzy would be a risk, and if you have a medical condition or are pregnant, ask first.',

    altLang: 'Leé esta página en español',
  },
};

/** Root-relative URL of a language's page, e.g. pageHref('en') → 'en.html' */
export function pageHref(lang) {
  return PAGES[lang].path || './';
}

/** Localized value of a preset field, independent of the UI language. */
function presetFieldFor(preset, field, lang) {
  return preset[field + (lang === 'es' ? 'Es' : 'En')];
}

/** FAQ entries as plain `{ q, a }` text — used for the FAQPage JSON-LD. */
export function faqItems(lang) {
  return SEO[lang].faq;
}

/**
 * The whole landing article as an HTML string.
 * @param {string} lang — 'es' | 'en'
 * @param {object} [opts]
 * @param {boolean} [opts.linkAlternate] — add a link to the other
 *        language's page. Only true on a built site: serving the repo
 *        root in development, that page doesn't exist.
 * @returns {string}
 */
export function renderSeo(lang, { linkAlternate = false } = {}) {
  const c = SEO[lang];
  const other = lang === 'es' ? 'en' : 'es';

  const techniques = PRESETS.map((preset) => {
    const extra = c.techniques[preset.soundDir] || {};
    const warn = presetFieldFor(preset, 'warn', lang);
    return `
        <article class="seo-technique">
          <h3>${presetFieldFor(preset, 'name', lang)}<span class="seo-timing">${preset.timing.join('-')}</span></h3>
          <p>${presetFieldFor(preset, 'desc', lang)}</p>
          ${extra.how ? `<p>${extra.how}</p>` : ''}
          ${extra.when ? `<p>${extra.when}</p>` : ''}
          ${warn ? `<p class="seo-warn"><span aria-hidden="true">⚠️</span> ${warn}</p>` : ''}
        </article>`;
  }).join('');

  const faq = c.faq
    .map(
      (item) => `
        <details class="seo-faq">
          <summary>${item.q}</summary>
          <p>${item.a}</p>
        </details>`,
    )
    .join('');

  return `
      <h2>${c.introHeading}</h2>
      ${c.intro.map((p) => `<p>${p}</p>`).join('')}

      <h2>${c.techniquesHeading}</h2>
      <p>${c.techniquesIntro}</p>
      ${techniques}

      <h2>${c.faqHeading}</h2>
      ${faq}

      <h2>${c.aboutHeading}</h2>
      ${c.about.map((p) => `<p>${p}</p>`).join('')}

      <h2>${c.disclaimerHeading}</h2>
      <p class="seo-disclaimer">${c.disclaimer}</p>
      ${
        linkAlternate
          ? `<p class="seo-altlang"><a href="${pageHref(other)}" hreflang="${other}" lang="${other}">${c.altLang}</a></p>`
          : ''
      }`;
}
