const times = {
    inhale: document.getElementById('time-inhale'),
    holdFull: document.getElementById('time-hold-full'),
    exhale: document.getElementById('time-exhale'),
    holdEmpty: document.getElementById('time-hold-empty')
};

const breathText = document.getElementById('breath-text');
const phaseTimerDisplay = document.getElementById('phase-timer');
const breathingCircle = document.getElementById('breathing-circle');
const startBtn = document.getElementById('start-btn');
const resetBtn = document.getElementById('reset-btn');
const sessionCounter = document.getElementById('session-counter');
const cycleCounter = document.getElementById('cycle-counter');
const lastSession = document.getElementById('last-session');
const volSlider = document.getElementById('volume-slider');

const audioIn = new Audio('inhala.mp3');
const audioHoldFull = new Audio('pausa_lleno.mp3');
const audioOut = new Audio('exhala.mp3');
const audioHoldEmpty = new Audio('pausa_vacio.mp3');

let isRunning = false;
let currentPhaseTimeout = null;
let timerInterval = null;
let phaseInterval = null;
let totalSeconds = 0;
let cycles = 0;

// Lógica de rueda del ratón con bloqueo de seguridad
Object.values(times).forEach(input => {
    input.addEventListener('wheel', (e) => {
        // BLOQUEO: Si está corriendo, ignoramos el scroll
        if (isRunning) return;

        e.preventDefault();
        let value = parseInt(input.value) || 0;
        
        if (e.deltaY < 0) {
            value++;
        } else {
            value--;
        }

        const min = parseInt(input.min) || 0;
        if (value < min) value = min;
        
        input.value = value;
    });
});

// Mouse wheel on volume slider
volSlider.addEventListener('wheel', (e) => {
    e.preventDefault();
    let value = parseFloat(volSlider.value);
    value += e.deltaY < 0 ? 0.1 : -0.1;
    value = Math.min(1, Math.max(0, parseFloat(value.toFixed(1))));
    volSlider.value = value;
}, { passive: false });

function toggleInputs(disabled) {
    Object.values(times).forEach(input => {
        input.disabled = disabled;
    });
    resetBtn.disabled = disabled;
}

function formatTime(s) {
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

function play(audio) {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volSlider.value;
    audio.play().catch(() => {});
}

function startPhaseCountdown(seconds) {
    clearInterval(phaseInterval);
    let remaining = seconds;
    phaseTimerDisplay.innerText = remaining;

    phaseInterval = setInterval(() => {
        remaining--;
        if (remaining > 0) {
            phaseTimerDisplay.innerText = remaining;
        } else {
            clearInterval(phaseInterval);
            phaseTimerDisplay.innerText = "";
        }
    }, 1000);
}

const TRANSITION_MS = 1200; // matches CSS transition duration

function setCircleState(state) {
    // state: 'idle' | 'collapsed' | 'active'
    breathingCircle.classList.remove('idle', 'collapsed', 'active');
    if (state !== 'idle') breathingCircle.classList.add(state);
    // 'idle' is the CSS default — no class needed
}

async function runFlow() {
    if (!isRunning) return;

    const tIn = parseInt(times.inhale.value);
    if (tIn > 0) {
        breathText.innerText = "Inhala";
        breathingCircle.style.transition = `transform ${tIn}s cubic-bezier(0.4,0,0.2,1), opacity ${tIn}s cubic-bezier(0.4,0,0.2,1), box-shadow ${tIn}s cubic-bezier(0.4,0,0.2,1)`;
        setCircleState('active');
        play(audioIn);
        startPhaseCountdown(tIn);
        await new Promise(r => currentPhaseTimeout = setTimeout(r, tIn * 1000));
    }

    if (!isRunning) return;
    const tHF = parseInt(times.holdFull.value);
    if (tHF > 0) {
        breathText.innerText = "Mantén";
        play(audioHoldFull);
        startPhaseCountdown(tHF);
        await new Promise(r => currentPhaseTimeout = setTimeout(r, tHF * 1000));
    }

    if (!isRunning) return;
    const tOut = parseInt(times.exhale.value);
    if (tOut > 0) {
        breathText.innerText = "Exhala";
        breathingCircle.style.transition = `transform ${tOut}s cubic-bezier(0.4,0,0.2,1), opacity ${tOut}s cubic-bezier(0.4,0,0.2,1), box-shadow ${tOut}s cubic-bezier(0.4,0,0.2,1)`;
        setCircleState('collapsed');
        play(audioOut);
        startPhaseCountdown(tOut);
        await new Promise(r => currentPhaseTimeout = setTimeout(r, tOut * 1000));
    }

    if (!isRunning) return;
    const tHE = parseInt(times.holdEmpty.value);
    if (tHE > 0) {
        breathText.innerText = "Espera";
        play(audioHoldEmpty);
        startPhaseCountdown(tHE);
        await new Promise(r => currentPhaseTimeout = setTimeout(r, tHE * 1000));
    }

    if (isRunning) {
        cycles++;
        cycleCounter.innerText = `Ciclos: ${cycles}`;
        runFlow();
    }
}

function startTimer() {
    // Lock everything during the entry transition
    toggleInputs(true);
    startBtn.disabled = true;

    breathText.innerText = "";
    phaseTimerDisplay.innerText = "";

    // Reset transition speed to the CSS default for the entry animation
    breathingCircle.style.transition = '';
    setCircleState('collapsed');

    setTimeout(() => {
        if (!startBtn.disabled) return; // aborted somehow
        isRunning = true;
        totalSeconds = 0;
        cycles = 0;

        startBtn.disabled = false;
        startBtn.innerText = "Detener";
        startBtn.style.background = "linear-gradient(135deg, rgba(220,60,80,0.6), rgba(180,30,50,0.5))";
        startBtn.style.borderColor = "rgba(220,100,100,0.3)";
        sessionCounter.innerText = "Sesión: 00:00";
        cycleCounter.innerText = "Ciclos: 0";

        timerInterval = setInterval(() => {
            totalSeconds++;
            sessionCounter.innerText = `Sesión: ${formatTime(totalSeconds)}`;
        }, 1000);

        runFlow();
    }, TRANSITION_MS);
}

function stopTimer() {
    isRunning = false;
    clearTimeout(currentPhaseTimeout);
    clearInterval(timerInterval);
    clearInterval(phaseInterval);

    lastSession.innerText = `Última: ${formatTime(totalSeconds)} (${cycles} ciclos)`;

    // Lock during exit transition
    toggleInputs(true);
    startBtn.disabled = true;
    startBtn.innerText = "Iniciar";
    startBtn.style.background = "";
    startBtn.style.borderColor = "";
    phaseTimerDisplay.innerText = "";
    breathText.innerText = "";

    // Animate back to idle
    breathingCircle.style.transition = '';
    setCircleState('idle');

    setTimeout(() => {
        breathText.innerText = "Listo";
        toggleInputs(false);
        startBtn.disabled = false;
        [audioIn, audioHoldFull, audioOut, audioHoldEmpty].forEach(a => a.pause());
    }, TRANSITION_MS);
}

startBtn.onclick = () => isRunning ? stopTimer() : startTimer();

resetBtn.onclick = () => {
    if (isRunning) return; // Seguridad extra
    times.inhale.value = 4;
    times.holdFull.value = 4;
    times.exhale.value = 4;
    times.holdEmpty.value = 4;
};