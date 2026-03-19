const times = {
    inhale: document.getElementById('time-inhale'),
    holdFull: document.getElementById('time-hold-full'),
    exhale: document.getElementById('time-exhale'),
    holdEmpty: document.getElementById('time-hold-empty')
};

const breathText = document.getElementById('breath-text');
const breathingCircle = document.getElementById('breathing-circle');
const startBtn = document.getElementById('start-btn');
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
let totalSeconds = 0;
let cycles = 0;

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

async function runFlow() {
    if (!isRunning) return;

    // 1. INHALA
    const tIn = parseInt(times.inhale.value) * 1000;
    if (tIn > 0) {
        breathText.innerText = "Inhala";
        breathingCircle.style.transition = `all ${tIn}ms ease-in-out`;
        breathingCircle.style.transform = "scale(1.4)";
        breathingCircle.style.opacity = "1";
        play(audioIn);
        await new Promise(r => currentPhaseTimeout = setTimeout(r, tIn));
    }

    // 2. PAUSA LLENO
    if (!isRunning) return;
    const tHF = parseInt(times.holdFull.value) * 1000;
    if (tHF > 0) {
        breathText.innerText = "Mantén";
        play(audioHoldFull);
        await new Promise(r => currentPhaseTimeout = setTimeout(r, tHF));
    }

    // 3. EXHALA
    if (!isRunning) return;
    const tOut = parseInt(times.exhale.value) * 1000;
    if (tOut > 0) {
        breathText.innerText = "Exhala";
        breathingCircle.style.transition = `all ${tOut}ms ease-in-out`;
        breathingCircle.style.transform = "scale(0.7)";
        breathingCircle.style.opacity = "0.15";
        play(audioOut);
        await new Promise(r => currentPhaseTimeout = setTimeout(r, tOut));
    }

    // 4. PAUSA VACÍO
    if (!isRunning) return;
    const tHE = parseInt(times.holdEmpty.value) * 1000;
    if (tHE > 0) {
        breathText.innerText = "Espera";
        play(audioHoldEmpty);
        await new Promise(r => currentPhaseTimeout = setTimeout(r, tHE));
    }

    // CICLO COMPLETADO
    if (isRunning) {
        cycles++;
        cycleCounter.innerText = `Ciclos: ${cycles}`;
        runFlow();
    }
}

function startTimer() {
    isRunning = true;
    totalSeconds = 0;
    cycles = 0;
    
    startBtn.innerText = "Detener";
    startBtn.style.backgroundColor = "#e74c3c";
    sessionCounter.innerText = "00:00";
    cycleCounter.innerText = "Ciclos: 0";

    timerInterval = setInterval(() => {
        totalSeconds++;
        sessionCounter.innerText = formatTime(totalSeconds);
    }, 1000);

    runFlow();
}

function stopTimer() {
    isRunning = false;
    clearTimeout(currentPhaseTimeout);
    clearInterval(timerInterval);
    
    // Guardar última sesión
    lastSession.innerText = `Última: ${formatTime(totalSeconds)} (${cycles} ciclos)`;
    
    startBtn.innerText = "Iniciar";
    startBtn.style.backgroundColor = "#0984e3";
    breathText.innerText = "Listo";
    
    // RESET INMEDIATO: Quitamos la transición para que vuelva al origen sin delay
    breathingCircle.style.transition = "none";
    breathingCircle.style.transform = "scale(0.7)";
    breathingCircle.style.opacity = "0.15";
    
    // Pausar todos los sonidos
    [audioIn, audioHoldFull, audioOut, audioHoldEmpty].forEach(a => a.pause());
}

startBtn.onclick = () => isRunning ? stopTimer() : startTimer();