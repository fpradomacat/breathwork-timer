// ── Neyen Tutorial ────────────────────────────────────────────
//
// Self-contained IIFE. No imports needed — it reads `applyLang`
// from window (exposed by main.js) and reads the lang button to
// detect the current language.
//
// Add <script src="tutorial.js"></script> after the module script
// in index.html. The tutorial resolves the AudioContext autoplay
// issue: the user must interact (click "Siguiente") before anything
// else can play.
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
  ];

  // ── Detect current language ───────────────────────────────────
  function getLang() {
    const btn = document.getElementById('lang-btn');
    return btn && btn.textContent.trim().toLowerCase() === 'en' ? 'en' : 'es';
  }

  // ── Build DOM ─────────────────────────────────────────────────
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

  // ── State ─────────────────────────────────────────────────────
  let currentStep = 0;

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

  // ── Init ──────────────────────────────────────────────────────
  function init() {
    renderStep(0);
  }

  if (
    document.readyState === 'complete' ||
    document.readyState === 'interactive'
  ) {
    requestAnimationFrame(() => setTimeout(init, 80));
  } else {
    window.addEventListener('DOMContentLoaded', () =>
      requestAnimationFrame(() => setTimeout(init, 80)),
    );
  }

  window.addEventListener('resize', () => {
    _spotRect = null;
    const step = STEPS[currentStep];
    positionSpotlight(step.target);
    setTimeout(() => positionCard(step.target, step.pos), 50);
  });
})();
