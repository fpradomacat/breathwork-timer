// ── Breathspace Tutorial ──────────────────────────────────────
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
            es: {
                title: '👋 Bienvenido a Breathspace',
                body:  'Tu espacio para respirar con intención. En 3 pasos te explicamos cómo funciona.',
            },
            en: {
                title: '👋 Welcome to Breathspace',
                body:  'Your space to breathe with intention. In 3 quick steps we\'ll show you how it works.',
            },
        },
        {
            target: '.controls-panel',
            pos: 'top',
            es: {
                title: '⚙️ Elige tu técnica',
                body:  'Ajusta los tiempos de cada fase: inhala, pausa, exhala y pausa vacío. O elige una técnica predefinida desde el menú ⚙.',
            },
            en: {
                title: '⚙️ Choose your technique',
                body:  'Set the duration for each phase: inhale, hold, exhale, and empty hold. Or pick a preset from the ⚙ menu.',
            },
        },
        {
            target: '#breathing-circle-container',
            pos: 'bottom',
            es: {
                title: '🫁 El círculo te guía',
                body:  'El círculo crece al inhalar y se contrae al exhalar. Sigue su ritmo y déjate llevar.',
            },
            en: {
                title: '🫁 The circle guides you',
                body:  'The circle expands as you inhale and shrinks as you exhale. Just follow its rhythm.',
            },
        },
        {
            target: '#start-btn',
            pos: 'top',
            es: {
                title: '▶️ Cuando estés listo',
                body:  'Pulsa <strong>Iniciar</strong> para comenzar la sesión. Puedes pausarla en cualquier momento.',
            },
            en: {
                title: '▶️ When you\'re ready',
                body:  'Press <strong>Start</strong> to begin your session. You can stop it at any time.',
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

    const spotlight = document.createElement('div');
    spotlight.id = 'tut-spotlight';

    const card = document.createElement('div');
    card.id = 'tut-card';

    const cardStep   = document.createElement('div');
    cardStep.id = 'tut-step-indicator';

    const cardTitle  = document.createElement('h2');
    cardTitle.id = 'tut-title';

    const cardBody   = document.createElement('p');
    cardBody.id = 'tut-body';

    const btnRow     = document.createElement('div');
    btnRow.id = 'tut-btn-row';

    const btnSkip    = document.createElement('button');
    btnSkip.id = 'tut-skip';

    const btnNext    = document.createElement('button');
    btnNext.id = 'tut-next';

    btnRow.appendChild(btnSkip);
    btnRow.appendChild(btnNext);
    card.appendChild(cardStep);
    card.appendChild(cardTitle);
    card.appendChild(cardBody);
    card.appendChild(btnRow);

    overlay.appendChild(spotlight);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // ── Styles (injected, self-contained) ─────────────────────
    const style = document.createElement('style');
    style.textContent = `
        #tut-overlay {
            position: fixed;
            inset: 0;
            z-index: 9999;
            /* dark vignette; the spotlight punches a hole via clip-path */
            background: rgba(0, 0, 0, 0.72);
            backdrop-filter: blur(2px);
            transition: opacity 0.35s ease;
        }
        #tut-overlay.tut-hiding {
            opacity: 0;
            pointer-events: none;
        }

        /* The "hole" spotlight — absolutely positioned box with a glowing ring */
        #tut-spotlight {
            position: fixed;
            border-radius: 16px;
            box-shadow:
                0 0 0 4px rgba(255,255,255,0.18),
                0 0 0 9999px rgba(0,0,0,0.72);
            transition: all 0.45s cubic-bezier(.4,0,.2,1);
            pointer-events: none;
            z-index: 10000;
        }
        #tut-spotlight.tut-hidden {
            opacity: 0;
            width: 0 !important;
            height: 0 !important;
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
    `;
    document.head.appendChild(style);

    // ── State ─────────────────────────────────────────────────
    let currentStep = 0;

    // ── Spotlight helper ──────────────────────────────────────
    const PADDING = 12; // px around the element

    function positionSpotlight(selector) {
        if (!selector) {
            spotlight.classList.add('tut-hidden');
            return;
        }
        const el = document.querySelector(selector);
        if (!el) { spotlight.classList.add('tut-hidden'); return; }

        spotlight.classList.remove('tut-hidden');
        const r = el.getBoundingClientRect();
        spotlight.style.left   = (r.left   - PADDING) + 'px';
        spotlight.style.top    = (r.top    - PADDING) + 'px';
        spotlight.style.width  = (r.width  + PADDING * 2) + 'px';
        spotlight.style.height = (r.height + PADDING * 2) + 'px';
    }

    // ── Card position helper ──────────────────────────────────
    const CARD_GAP = 18; // px between spotlight and card

    function positionCard(selector, pos) {
        // Reset so we can measure natural size
        card.style.left = card.style.top = card.style.transform = '';

        if (!selector || pos === 'center') {
            card.style.left = '50%';
            card.style.top  = '50%';
            card.style.transform = 'translate(-50%, -50%)';
            return;
        }

        const el = document.querySelector(selector);
        if (!el) {
            card.style.left = '50%';
            card.style.top  = '50%';
            card.style.transform = 'translate(-50%, -50%)';
            return;
        }

        const r   = el.getBoundingClientRect();
        const cW  = card.offsetWidth  || 360;
        const cH  = card.offsetHeight || 200;
        const vW  = window.innerWidth;
        const vH  = window.innerHeight;
        const PAD = 16;

        let left, top;

        if (pos === 'bottom') {
            top  = r.bottom + PADDING + CARD_GAP;
            left = r.left + r.width / 2 - cW / 2;
        } else if (pos === 'top') {
            top  = r.top - PADDING - CARD_GAP - cH;
            left = r.left + r.width / 2 - cW / 2;
        } else if (pos === 'left') {
            left = r.left - PADDING - CARD_GAP - cW;
            top  = r.top + r.height / 2 - cH / 2;
        } else { // right
            left = r.right + PADDING + CARD_GAP;
            top  = r.top + r.height / 2 - cH / 2;
        }

        // Clamp within viewport
        left = Math.max(PAD, Math.min(left, vW - cW - PAD));
        top  = Math.max(PAD, Math.min(top,  vH - cH - PAD));

        card.style.left      = left + 'px';
        card.style.top       = top  + 'px';
        card.style.transform = 'none';
    }

    // ── Render a step ─────────────────────────────────────────
    function renderStep(index) {
        const step = STEPS[index];
        const lang = getLang();
        const t    = step[lang] || step['es'];
        const isLast = index === STEPS.length - 1;

        // Step indicator dots
        const dots = STEPS.map((_, i) =>
            `<span class="tut-dot${i === index ? ' active' : ''}"></span>`
        ).join('');
        cardStep.innerHTML = `<div class="tut-dots">${dots}</div>`;

        cardTitle.textContent  = t.title;
        cardBody.innerHTML     = t.body;
        btnNext.textContent    = isLast
            ? (lang === 'es' ? '¡Empezar! 🎉' : 'Let\'s go! 🎉')
            : (lang === 'es' ? 'Siguiente →' : 'Next →');
        btnSkip.textContent    = lang === 'es' ? 'Saltar tutorial' : 'Skip tutorial';

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
        // Only persist when the user actually finishes or explicitly skips —
        // not on intermediate "Siguiente" clicks, so F5 mid-tutorial still shows it.
        setTimeout(() => overlay.remove(), 400);
    }

    btnNext.addEventListener('click', advance);
    btnSkip.addEventListener('click', closeTutorial);

    // ── Init ──────────────────────────────────────────────────
    // Wait for DOM to be fully painted before measuring positions
    function init() {
        renderStep(0);
    }

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        // Small rAF delay so layout is stable
        requestAnimationFrame(() => setTimeout(init, 80));
    } else {
        window.addEventListener('DOMContentLoaded', () =>
            requestAnimationFrame(() => setTimeout(init, 80)));
    }

    // Reposition on resize
    window.addEventListener('resize', () => {
        const step = STEPS[currentStep];
        positionSpotlight(step.target);
        setTimeout(() => positionCard(step.target, step.pos), 50);
    });

})();