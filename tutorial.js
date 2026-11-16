// ── Neyen Tutorial ────────────────────────────────────────────
//
// Self-contained IIFE. No imports needed — it calls `applyLang`
// (exposed on window by main.js) and reads <html lang> to detect the
// current language.
//
// Shown automatically only on the first visit (localStorage flag
// "neyen.tutorialDone"); afterwards it can be reopened with the "?"
// button via window.showTutorial().
// ─────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── Steps ────────────────────────────────────────────────────
  // target: CSS selector to spotlight  (null = center, no spotlight)
  // pos:    card position relative to spotlight
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
      target: null,
      pos: 'center',
      es: {
        title: '🕐 Cuándo y cuánto',
        body: 'Con <strong>5 minutos</strong> alcanza para empezar. Con el tiempo podés ir a 10–15.<br><br>🌀 <strong>Ansiedad o estrés</strong> — Coherencia Cardíaca o 4-7-8<br>😴 <strong>Dormir</strong> — 4-7-8<br>⚖️ <strong>Equilibrio general</strong> — Respiración Cuadrada<br>⚡ <strong>Activarte</strong> — Fuego',
      },
      en: {
        title: '🕐 When and how long',
        body: '<strong>5 minutes</strong> is enough to start. Over time you can go up to 10–15.<br><br>🌀 <strong>Anxiety or stress</strong> — Cardiac Coherence or 4-7-8<br>😴 <strong>Sleep</strong> — 4-7-8<br>⚖️ <strong>Balance & reset</strong> — Box Breathing<br>⚡ <strong>Energy boost</strong> — Fire Breath',
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
        body: 'Explora diferentes técnicas de respiración y elige la que mejor se adapte a tus necesidades. Cada técnica está diseñada para ayudarte a alcanzar un objetivo distinto, como relajarte, concentrarte o recuperar energía.',
      },
      en: {
        title: '✦ Techniques',
        body: 'Explore different breathing techniques and choose the one that best fits your needs. Each technique is designed to support a different goal, such as relaxation, focus, or renewed energy.',
      },
    },
    {
      target: '.sound-toggles',
      pos: 'top',
      es: {
        title: '🎚️ Tus sonidos',
        body: 'Activá o desactivá cada sonido cuando quieras, incluso durante la sesión:<br><br>🎵 Música ambiente<br>🗣️ Voz guía<br>🌬️ Sonido de respiración<br>⏱️ Segundos<br><br>Los sonidos que marcan cada fase siempre suenan. Tu elección se guarda para la próxima vez.',
      },
      en: {
        title: '🎚️ Your sounds',
        body: 'Turn each sound on or off anytime, even during a session:<br><br>🎵 Ambient music<br>🗣️ Voice guide<br>🌬️ Breathing sound<br>⏱️ Second ticks<br><br>The phase cues always play. Your choice is saved for next time.',
      },
    },
  ];

  // ── Detect current language ───────────────────────────────────
  function getLang() {
    return document.documentElement.lang === 'en' ? 'en' : 'es';
  }

  // ── "Already seen" flag ───────────────────────────────────────
  const DONE_KEY = 'neyen.tutorialDone';
  function isDone() {
    try {
      return localStorage.getItem(DONE_KEY) === 'true';
    } catch {
      return false;
    }
  }
  function markDone() {
    try {
      localStorage.setItem(DONE_KEY, 'true');
    } catch {
      // storage unavailable — it will just show again next visit
    }
  }

  // ── Build DOM ─────────────────────────────────────────────────
  const overlay = document.createElement('div');
  overlay.id = 'tut-overlay';

  const canvas = document.createElement('canvas');
  canvas.id = 'tut-canvas';

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
  // canvas + overlay are attached to the page only while the tutorial is open

  // ── Styles ────────────────────────────────────────────────────
  const style = document.createElement('style');
  style.textContent = `
    #tut-overlay {
      position: fixed; inset: 0; z-index: 9999;
      pointer-events: all; transition: opacity 0.35s ease;
    }
    #tut-overlay.tut-hiding { opacity: 0; pointer-events: none; }

    #tut-canvas {
      position: fixed; inset: 0; width: 100%; height: 100%;
      pointer-events: none; z-index: 9999;
    }

    #tut-card {
      position: fixed; z-index: 10001;
      width: min(360px, calc(100vw - 40px));
      background: linear-gradient(145deg, rgba(28,28,42,0.97), rgba(20,20,34,0.99));
      border: 1px solid rgba(255,255,255,0.10); border-radius: 20px;
      padding: 28px 26px 22px;
      box-shadow: 0 24px 64px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04);
      transition: opacity 0.4s ease, transform 0.4s cubic-bezier(.4,0,.2,1);
      opacity: 0;
      color: #e8e8f0; font-family: inherit;
    }

    #tut-card.tut-card-visible {
      opacity: 1;
    }

    #tut-step-indicator {
      font-size: 11px; font-weight: 600; letter-spacing: 0.1em;
      text-transform: uppercase; color: rgba(160,160,200,0.6); margin-bottom: 10px;
    }
    #tut-title  { font-size: 17px; font-weight: 700; margin: 0 0 10px; color: #fff; line-height: 1.3; }
    #tut-body   { font-size: 14px; line-height: 1.65; color: rgba(210,210,230,0.85); margin: 0 0 22px; }

    #tut-btn-row {
      display: flex; align-items: center; justify-content: space-between; gap: 10px;
    }

    #tut-skip {
      background: none; border: none; color: rgba(160,160,200,0.5);
      font-size: 13px; cursor: pointer; padding: 0;
      transition: color 0.2s; font-family: inherit;
    }
    #tut-skip:hover { color: rgba(200,200,230,0.8); }

    #tut-next {
      background: linear-gradient(135deg, rgba(100,120,255,0.85), rgba(70,90,210,0.9));
      border: 1px solid rgba(140,160,255,0.25); color: #fff;
      font-size: 14px; font-weight: 600; padding: 10px 24px;
      border-radius: 50px; cursor: pointer; font-family: inherit;
      transition: transform 0.15s, box-shadow 0.15s, background 0.2s;
      box-shadow: 0 4px 18px rgba(80,100,255,0.3);
    }
    #tut-next:hover  { transform: translateY(-1px); box-shadow: 0 6px 24px rgba(80,100,255,0.45); }
    #tut-next:active { transform: translateY(0); }

    .tut-dots { display: flex; gap: 5px; align-items: center; }
    .tut-dot  { width: 6px; height: 6px; border-radius: 50%; background: rgba(255,255,255,0.18); transition: all 0.3s; }
    .tut-dot.active { background: rgba(120,140,255,0.9); width: 18px; border-radius: 3px; }

    #tut-lang-picker { display: flex; gap: 10px; margin-top: 14px; }
    .tut-lang-btn {
      flex: 1; padding: 10px 0; border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05);
      color: rgba(210,210,230,0.75); font-size: 14px; font-family: inherit;
      cursor: pointer; transition: border-color 0.2s, background 0.2s, color 0.2s;
    }
    .tut-lang-btn:hover { background: rgba(255,255,255,0.09); color: #fff; }
    .tut-lang-btn.tut-lang-active {
      border-color: rgba(120,140,255,0.7); background: rgba(100,120,255,0.18); color: #fff;
    }
  `;
  document.head.appendChild(style);

  // ── State ─────────────────────────────────────────────────────
  let currentStep = 0;
  let isOpen = false;

  // ── Canvas spotlight ──────────────────────────────────────────
  const PADDING = 14;
  const RADIUS = 16;
  let _spotRect = null;
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

    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);

    if (w > 0 && h > 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.roundRect(x, y, w, h, RADIUS);
      ctx.fill();
      ctx.restore();

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
    const tx = r.left - PADDING,
      ty = r.top - PADDING;
    const tw = r.width + PADDING * 2,
      th = r.height + PADDING * 2;

    if (!_spotRect) {
      _spotRect = { x: tx, y: ty, w: tw, h: th };
    } else {
      const sp = 0.12;
      _spotRect.x = lerp(_spotRect.x, tx, sp);
      _spotRect.y = lerp(_spotRect.y, ty, sp);
      _spotRect.w = lerp(_spotRect.w, tw, sp);
      _spotRect.h = lerp(_spotRect.h, th, sp);
    }

    drawMask(_spotRect.x, _spotRect.y, _spotRect.w, _spotRect.h);

    if (Math.abs(_spotRect.x - tx) > 0.5 || Math.abs(_spotRect.y - ty) > 0.5) {
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

  // ── Card positioning ──────────────────────────────────────────
  const CARD_GAP = 18;

  function positionCard(selector, pos) {
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
      left = r.right + PADDING + CARD_GAP;
      top = r.top + r.height / 2 - cH / 2;
    }

    left = Math.max(PAD, Math.min(left, vW - cW - PAD));
    top = Math.max(PAD, Math.min(top, vH - cH - PAD));
    card.style.left = left + 'px';
    card.style.top = top + 'px';
    card.style.transform = 'none';
  }

  // ── Render step ───────────────────────────────────────────────
  function renderStep(index) {
    const step = STEPS[index];
    const l = getLang();
    const t = step[l] || step['es'];
    const isLast = index === STEPS.length - 1;

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
        '<button class="tut-lang-btn" data-lang="es">🇪🇸 Español</button>' +
        '<button class="tut-lang-btn" data-lang="en">🇬🇧 English</button>';
      cardBody.appendChild(picker);
      picker.querySelectorAll('.tut-lang-btn').forEach((btn) => {
        if (btn.dataset.lang === l) btn.classList.add('tut-lang-active');
        btn.addEventListener('click', () => {
          picker
            .querySelectorAll('.tut-lang-btn')
            .forEach((b) => b.classList.remove('tut-lang-active'));
          btn.classList.add('tut-lang-active');
          // applyLang is exposed on window by main.js
          if (typeof window.applyLang === 'function')
            window.applyLang(btn.dataset.lang);
          renderStep(index);
        });
      });
    }

    btnNext.textContent = isLast
      ? l === 'es'
        ? '¡Empezar! 🎉'
        : "Let's go! 🎉"
      : l === 'es'
        ? 'Siguiente →'
        : 'Next →';
    btnSkip.textContent = l === 'es' ? 'Saltar tutorial' : 'Skip tutorial';

    positionSpotlight(step.target);
    setTimeout(() => positionCard(step.target, step.pos), 50);
  }

  // ── Navigation ────────────────────────────────────────────────
  function advance() {
    if (currentStep < STEPS.length - 1) {
      currentStep++;
      renderStep(currentStep);
    } else {
      closeTutorial();
    }
  }

  function closeTutorial() {
    if (!isOpen) return;
    isOpen = false;
    markDone();
    cancelAnimationFrame(_spotRAF);
    overlay.classList.add('tut-hiding');
    canvas.style.transition = 'opacity 0.35s';
    canvas.style.opacity = '0';
    setTimeout(() => {
      if (isOpen) return; // reopened during the fade-out
      overlay.remove();
      canvas.remove();
    }, 400);
  }

  btnNext.addEventListener('click', advance);
  btnSkip.addEventListener('click', closeTutorial);

  // ── Open ──────────────────────────────────────────────────────
  function openTutorial() {
    if (isOpen) return;
    isOpen = true;
    currentStep = 0;
    _spotRect = null;
    overlay.classList.remove('tut-hiding');
    card.classList.remove('tut-card-visible');
    canvas.style.transition = '';
    canvas.style.opacity = '1';
    document.body.appendChild(canvas);
    document.body.appendChild(overlay);
    renderStep(0);
    // Position is calculated synchronously inside renderStep/positionCard.
    // One rAF tick lets the browser apply the layout, then we fade in.
    requestAnimationFrame(() => card.classList.add('tut-card-visible'));
  }

  // Reopen from the "?" button (main.js)
  window.showTutorial = openTutorial;

  // First visit only
  if (!isDone()) {
    const start = () => requestAnimationFrame(() => setTimeout(openTutorial, 80));
    if (document.readyState === 'loading')
      window.addEventListener('DOMContentLoaded', start);
    else start();
  }

  document.addEventListener('keydown', (e) => {
    if (isOpen && e.key === 'Escape') closeTutorial();
  });

  window.addEventListener('resize', () => {
    if (!isOpen) return;
    _spotRect = null;
    const step = STEPS[currentStep];
    positionSpotlight(step.target);
    setTimeout(() => positionCard(step.target, step.pos), 50);
  });
})();
