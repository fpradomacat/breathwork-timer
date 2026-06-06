// ── Neyen Tutorial ──────────────────────────────────────
// Drop-in file. Just add <script src="tutorial.js"></script>
// before </body> in index.html (after script.js).
// No changes to existing code needed.
// Also resolves the AudioContext autoplay issue: the user must
// click "Siguiente" before interacting with anything else.
// ─────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── Steps definition ─────────────────────────────────────
  // target: CSS selector to spotlight (null = center, no spotlight)
  // pos:    where to place the tooltip card relative to the spotlight
  //         'bottom' | 'top' | 'left' | 'right' | 'center'
  const STEPS = [
    {
      target: null,
      pos: 'center',
      langPicker: true,
      es: {
        title: '👋 Bienvenido a Neyen',
        body: 'Técnicas de respiración guiadas para calmar, enfocar o energizarte.<br><br>🎙️ Mi voz te acompañará en los primeros ciclos para guiarte — luego se va y respirás en silencio.<br><br>🌬️ <strong>Nariz o boca:</strong> respirar por la nariz activa más el sistema nervioso parasimpático y profundiza la calma. Por la boca es más activante e inmediato. Probá los dos.<br><br>Primero, elige tu idioma:',
      },
      en: {
        title: '👋 Welcome to Neyen',
        body: 'Guided breathing techniques to calm, focus, or energize you.<br><br>🎙️ My voice will guide you through the first few cycles — then it fades and you breathe in silence.<br><br>🌬️ <strong>Nose or mouth:</strong> breathing through the nose engages the parasympathetic nervous system more deeply, amplifying calm. Through the mouth is more activating and immediate. Try both.<br><br>First, choose your language:',
      },
    },
    {
      target: '#breathing-circle-container',
      pos: 'bottom',
      es: {
        title: '🫁 El círculo te guía',
        body: 'El círculo crece al inhalar y se contrae al exhalar. Seguí su ritmo.<br><br><strong>Tocalo</strong> para iniciar la sesión. Tocalo de nuevo para detenerla.',
      },
      en: {
        title: '🫁 The circle guides you',
        body: 'The circle expands as you inhale and shrinks as you exhale. Follow its rhythm.<br><br><strong>Tap it</strong> to start the session. Tap again to stop.',
      },
    },
    {
      target: '.stats-box',
      pos: 'bottom',
      es: {
        title: '📊 Tus estadísticas',
        body: 'Aquí ves el tiempo de sesión, los ciclos completados y la última sesión.',
      },
      en: {
        title: '📊 Your stats',
        body: 'Session time, completed cycles and last session at a glance.',
      },
    },
    {
      target: '.action-pills',
      pos: 'top',
      es: {
        title: '✦ Técnicas',
        body: 'Explora diferentes técnicas de respiración y elige la que mejor se adapte a tus necesidades. Cada técnica está diseñada para ayudarte a alcanzar un objetivo distinto, como relajarte, concentrarte o recuperar energía. Ajusta tu ritmo y encuentra la experiencia que más te beneficie.',
      },
      en: {
        title: '✦ Techniques',
        body: 'Explore different breathing techniques and choose the one that best fits your needs. Each technique is designed to support a different goal, such as relaxation, focus, or renewed energy. Adjust your breathing rhythm and find the experience that works best for you.',
      },
    },
  ];

  // ── Detect lang from the page (matches app logic) ─────────
  function getLang() {
    const btn = document.getElementById('lang-btn');
    return btn && btn.textContent.trim().toLowerCase() === 'en' ? 'en' : 'es';
  }

  // ── Build DOM ─────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'tut-overlay';

  const canvas = document.createElement('canvas');
  canvas.id = 'tut-canvas';
  document.body.appendChild(canvas);

  const card = document.createElement('div');
  card.id = 'tut-card';

  const cardStep = document.createElement('div');
  cardStep.id = 'tut-step-indicator';

  const cardTitle = document.createElement('h2');
  cardTitle.id = 'tut-title';

  const cardBody = document.createElement('p');
  cardBody.id = 'tut-body';

  const btnRow = document.createElement('div');
  btnRow.id = 'tut-btn-row';

  const btnSkip = document.createElement('button');
  btnSkip.id = 'tut-skip';

  const btnNext = document.createElement('button');
  btnNext.id = 'tut-next';

  btnRow.appendChild(btnSkip);
  btnRow.appendChild(btnNext);
  card.appendChild(cardStep);
  card.appendChild(cardTitle);
  card.appendChild(cardBody);
  card.appendChild(btnRow);

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  // ── Styles (injected, self-contained) ─────────────────────
  const style = document.createElement('style');
  style.textContent = `
        #tut-overlay {
            position: fixed;
            inset: 0;
            z-index: 9999;
            pointer-events: all;
            transition: opacity 0.35s ease;
        }
        #tut-overlay.tut-hiding {
            opacity: 0;
            pointer-events: none;
        }

        /* Canvas draws the dark mask with a transparent hole */
        #tut-canvas {
            position: fixed;
            inset: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 9999;
        }

        /* Tooltip card */
        #tut-card {
            position: fixed;
            z-index: 10001;
            width: min(360px, calc(100vw - 40px));
            background: linear-gradient(145deg, rgba(28,28,42,0.97), rgba(20,20,34,0.99));
            border: 1px solid rgba(255,255,255,0.10);
            border-radius: 20px;
            padding: 28px 26px 22px;
            box-shadow: 0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04);
            transition: all 0.4s cubic-bezier(.4,0,.2,1);
            color: #e8e8f0;
            font-family: inherit;
        }

        #tut-step-indicator {
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 0.1em;
            text-transform: uppercase;
            color: rgba(160,160,200,0.6);
            margin-bottom: 10px;
        }

        #tut-title {
            font-size: 17px;
            font-weight: 700;
            margin: 0 0 10px;
            color: #fff;
            line-height: 1.3;
        }

        #tut-body {
            font-size: 14px;
            line-height: 1.65;
            color: rgba(210,210,230,0.85);
            margin: 0 0 22px;
        }

        #tut-btn-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
        }

        #tut-skip {
            background: none;
            border: none;
            color: rgba(160,160,200,0.5);
            font-size: 13px;
            cursor: pointer;
            padding: 0;
            transition: color 0.2s;
            font-family: inherit;
        }
        #tut-skip:hover { color: rgba(200,200,230,0.8); }

        #tut-next {
            background: linear-gradient(135deg, rgba(100,120,255,0.85), rgba(70,90,210,0.9));
            border: 1px solid rgba(140,160,255,0.25);
            color: #fff;
            font-size: 14px;
            font-weight: 600;
            padding: 10px 24px;
            border-radius: 50px;
            cursor: pointer;
            font-family: inherit;
            transition: transform 0.15s, box-shadow 0.15s, background 0.2s;
            box-shadow: 0 4px 18px rgba(80,100,255,0.3);
        }
        #tut-next:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 24px rgba(80,100,255,0.45);
        }
        #tut-next:active { transform: translateY(0); }

        /* Step dots */
        .tut-dots {
            display: flex;
            gap: 5px;
            align-items: center;
        }
        .tut-dot {
            width: 6px; height: 6px;
            border-radius: 50%;
            background: rgba(255,255,255,0.18);
            transition: all 0.3s;
        }
        .tut-dot.active {
            background: rgba(120,140,255,0.9);
            width: 18px;
            border-radius: 3px;
        }

        #tut-lang-picker {
            display: flex;
            gap: 10px;
            margin-top: 14px;
        }
        .tut-lang-btn {
            flex: 1;
            padding: 10px 0;
            border-radius: 12px;
            border: 1px solid rgba(255,255,255,0.12);
            background: rgba(255,255,255,0.05);
            color: rgba(210,210,230,0.75);
            font-size: 14px;
            font-family: inherit;
            cursor: pointer;
            transition: border-color 0.2s, background 0.2s, color 0.2s;
            box-shadow: none;
        }
        .tut-lang-btn:hover {
            background: rgba(255,255,255,0.09);
            color: #fff;
        }
        .tut-lang-btn.tut-lang-active {
            border-color: rgba(120,140,255,0.7);
            background: rgba(100,120,255,0.18);
            color: #fff;
        }
    `;
  document.head.appendChild(style);

  // ── State ─────────────────────────────────────────────────
  let currentStep = 0;

  // ── Canvas spotlight ──────────────────────────────────────
  const PADDING = 14; // px around the element
  const RADIUS = 16; // corner radius of the hole
  let _spotRect = null; // current animated rect {x,y,w,h}
  let _spotTarget = null;
  let _spotRAF = null;

  function drawMask(x, y, w, h) {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    if (w > 0 && h > 0) {
      // Cut a rounded-rect hole using composite operation
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, RADIUS);
      ctx.fill();
      ctx.restore();

      // Glow ring around the hole
      ctx.save();
      ctx.strokeStyle = 'rgba(255,255,255,0.22)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.roundRect(x - 1, y - 1, w + 2, h + 2, RADIUS + 1);
      ctx.stroke();
      ctx.restore();
    }
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function animateSpotlight() {
    if (!_spotTarget) {
      drawMask(0, 0, 0, 0);
      return;
    }
    const el = document.querySelector(_spotTarget);
    if (!el) {
      drawMask(0, 0, 0, 0);
      return;
    }

    const r = el.getBoundingClientRect();
    const tx = r.left - PADDING;
    const ty = r.top - PADDING;
    const tw = r.width + PADDING * 2;
    const th = r.height + PADDING * 2;

    if (!_spotRect) {
      _spotRect = { x: tx, y: ty, w: tw, h: th };
    } else {
      const speed = 0.12;
      _spotRect.x = lerp(_spotRect.x, tx, speed);
      _spotRect.y = lerp(_spotRect.y, ty, speed);
      _spotRect.w = lerp(_spotRect.w, tw, speed);
      _spotRect.h = lerp(_spotRect.h, th, speed);
    }

    const dx = Math.abs(_spotRect.x - tx);
    const dy = Math.abs(_spotRect.y - ty);
    drawMask(_spotRect.x, _spotRect.y, _spotRect.w, _spotRect.h);

    if (dx > 0.5 || dy > 0.5) {
      _spotRAF = requestAnimationFrame(animateSpotlight);
    }
  }

  function positionSpotlight(selector) {
    cancelAnimationFrame(_spotRAF);
    _spotTarget = selector || null;
    if (!selector) {
      drawMask(0, 0, 0, 0);
      return;
    }
    animateSpotlight();
    _spotRAF = requestAnimationFrame(animateSpotlight);
  }

  // ── Card position helper ──────────────────────────────────
  const CARD_GAP = 18; // px between spotlight and card

  function positionCard(selector, pos) {
    // Reset so we can measure natural size
    card.style.left = card.style.top = card.style.transform = '';

    if (!selector || pos === 'center') {
      card.style.left = '50%';
      card.style.top = '50%';
      card.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const el = document.querySelector(selector);
    if (!el) {
      card.style.left = '50%';
      card.style.top = '50%';
      card.style.transform = 'translate(-50%, -50%)';
      return;
    }

    const r = el.getBoundingClientRect();
    const cW = card.offsetWidth || 360;
    const cH = card.offsetHeight || 200;
    const vW = window.innerWidth;
    const vH = window.innerHeight;
    const PAD = 16;

    let left, top;

    if (pos === 'bottom') {
      top = r.bottom + PADDING + CARD_GAP;
      left = r.left + r.width / 2 - cW / 2;
    } else if (pos === 'top') {
      top = r.top - PADDING - CARD_GAP - cH;
      left = r.left + r.width / 2 - cW / 2;
    } else if (pos === 'left') {
      left = r.left - PADDING - CARD_GAP - cW;
      top = r.top + r.height / 2 - cH / 2;
    } else {
      // right
      left = r.right + PADDING + CARD_GAP;
      top = r.top + r.height / 2 - cH / 2;
    }

    // Clamp within viewport
    left = Math.max(PAD, Math.min(left, vW - cW - PAD));
    top = Math.max(PAD, Math.min(top, vH - cH - PAD));

    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.style.transform = 'none';
  }

  // ── Render a step ─────────────────────────────────────────
  function renderStep(index) {
    const step = STEPS[index];
    const lang = getLang();
    const t = step[lang] || step['es'];
    const isLast = index === STEPS.length - 1;

    // Step indicator dots
    const dots = STEPS.map(
      (_, i) => `<span class="tut-dot${i === index ? ' active' : ''}"></span>`,
    ).join('');
    cardStep.innerHTML = `<div class="tut-dots">${dots}</div>`;

    cardTitle.textContent = t.title;
    cardBody.innerHTML = t.body;

    if (step.langPicker) {
      const picker = document.createElement('div');
      picker.id = 'tut-lang-picker';
      picker.innerHTML =
        '<button class="tut-lang-btn" data-lang="es">\uD83C\uDDEA\uD83C\uDDF8 Espa\u00F1ol</button>' +
        '<button class="tut-lang-btn" data-lang="en">\uD83C\uDDEC\uD83C\uDDE7 English</button>';
      cardBody.appendChild(picker);
      picker.querySelectorAll('.tut-lang-btn').forEach(function (btn) {
        if (btn.dataset.lang === lang) btn.classList.add('tut-lang-active');
        btn.addEventListener('click', function () {
          picker.querySelectorAll('.tut-lang-btn').forEach(function (b) {
            b.classList.remove('tut-lang-active');
          });
          btn.classList.add('tut-lang-active');
          if (typeof applyLang === 'function') applyLang(btn.dataset.lang);
          renderStep(index);
        });
      });
    }

    btnNext.textContent = isLast
      ? lang === 'es'
        ? '\u00A1Empezar! \uD83C\uDF89'
        : "Let's go! \uD83C\uDF89"
      : lang === 'es'
        ? 'Siguiente \u2192'
        : 'Next \u2192';
    btnSkip.textContent = lang === 'es' ? 'Saltar tutorial' : 'Skip tutorial';

    positionSpotlight(step.target);

    // Small delay so spotlight animates before card repositions
    setTimeout(() => positionCard(step.target, step.pos), 50);
  }

  // ── Navigation ────────────────────────────────────────────
  function advance() {
    // This click is the user gesture that unlocks AudioContext
    if (currentStep < STEPS.length - 1) {
      currentStep++;
      renderStep(currentStep);
    } else {
      closeTutorial();
    }
  }

  function closeTutorial() {
    overlay.classList.add('tut-hiding');
    canvas.style.transition = 'opacity 0.35s';
    canvas.style.opacity = '0';
    setTimeout(() => {
      overlay.remove();
      canvas.remove();
    }, 400);
  }

  btnNext.addEventListener('click', advance);
  btnSkip.addEventListener('click', closeTutorial);

  // ── Init ──────────────────────────────────────────────────
  // Wait for DOM to be fully painted before measuring positions
  function init() {
    renderStep(0);
  }

  if (
    document.readyState === 'complete' ||
    document.readyState === 'interactive'
  ) {
    // Small rAF delay so layout is stable
    requestAnimationFrame(() => setTimeout(init, 80));
  } else {
    window.addEventListener('DOMContentLoaded', () =>
      requestAnimationFrame(() => setTimeout(init, 80)),
    );
  }

  // Reposition on resize
  window.addEventListener('resize', () => {
    _spotRect = null; // reset so it snaps instead of animating from wrong pos
    const step = STEPS[currentStep];
    positionSpotlight(step.target);
    setTimeout(() => positionCard(step.target, step.pos), 50);
  });

  // MUSICA DE FONDO AMBIENTAL (con fade y toggle, sin romper el autoplay)
  const Ambient = (() => {
    let ctx = null;
    let source = null;
    let gainNode = null;
    let buffer = null;
    let muted = false;
    let loaded = false;
    const VOLUME = 0.15;
    const FADE = 2;

    async function load() {
      ctx = new AudioContext();
      gainNode = ctx.createGain();
      gainNode.gain.value = 0;
      gainNode.connect(ctx.destination);

      const res = await fetch('assets/sounds/background-music.mp3');
      const arr = await res.arrayBuffer();
      buffer = await ctx.decodeAudioData(arr);
      loaded = true;
    }

    function play() {
      if (!loaded || !buffer) return;
      source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gainNode);
      source.start(0);
      if (!muted) fadeTo(VOLUME);
    }

    function fadeTo(target) {
      gainNode.gain.cancelScheduledValues(ctx.currentTime);
      gainNode.gain.setValueAtTime(gainNode.gain.value, ctx.currentTime);
      gainNode.gain.linearRampToValueAtTime(target, ctx.currentTime + FADE);
    }

    async function init() {
      await load();
      play();
    }

    function toggle() {
      muted = !muted;
      fadeTo(muted ? 0 : VOLUME);
      document.getElementById('ambient-btn')?.classList.toggle('muted', muted);
    }

    function bootstrap() {
      const events = ['click', 'touchend', 'keydown'];
      const handler = () => {
        init();
        events.forEach((ev) => document.removeEventListener(ev, handler));
      };
      events.forEach((ev) =>
        document.addEventListener(ev, handler, { once: true, passive: true }),
      );
    }

    return { bootstrap, toggle };
  })();

  Ambient.bootstrap();

  document.getElementById('ambient-btn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    Ambient.toggle();
  });
})();