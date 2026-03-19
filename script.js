const slider = document.getElementById('time-slider');
const volSlider = document.getElementById('volume-slider');
const display = document.getElementById('current-time');
const breathText = document.getElementById('breath-text');
const startBtn = document.getElementById('start-btn');
const breathingCircle = document.getElementById('breathing-circle');
const sessionCounter = document.getElementById('session-counter');
const cycleCounter = document.getElementById('cycle-counter');
const lastSession = document.getElementById('last-session');

const audioIn = new Audio('inhala.mp3');
const audioOut = new Audio('exhala.mp3');

let interval = null;
let timerInterval = null;
let totalSeconds = 0;
let cycles = 0;
let isRunning = false;
let isInhaling = true;

function formatTime(s) {
    const mins = Math.floor(s / 60).toString().padStart(2, '0');
    const secs = (s % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
}

function playSound(audio) {
    audio.pause();
    audio.currentTime = 0;
    audio.volume = volSlider.value;
    audio.play().catch(() => {});
}

function startTimer() {
    const seconds = parseFloat(slider.value);
    isRunning = true;
    isInhaling = true;
    cycles = 0;
    totalSeconds = 0;
    
    startBtn.innerText = "Detener";
    startBtn.style.backgroundColor = "#e74c3c";
    cycleCounter.innerText = "Ciclos: 0";
    sessionCounter.innerText = "00:00";

    // Cronómetro de tiempo real
    timerInterval = setInterval(() => {
        totalSeconds++;
        sessionCounter.innerText = formatTime(totalSeconds);
    }, 1000);

    // Animación
    breathingCircle.style.animation = 'none';
    breathingCircle.offsetHeight; 
    breathingCircle.style.animation = `breathe ${seconds}s infinite alternate cubic-bezier(0.45, 0.05, 0.55, 0.95)`;
    
    breathText.innerText = "Inhala";
    playSound(audioIn);

    // Lógica de respiración y conteo de ciclos
    interval = setInterval(() => {
        isInhaling = !isInhaling;
        if (isInhaling) {
            breathText.innerText = "Inhala";
            playSound(audioIn);
        } else {
            breathText.innerText = "Exhala";
            playSound(audioOut);
            // El ciclo se completa al terminar la exhalación (cuando vuelve a empezar)
            cycles++;
            cycleCounter.innerText = `Ciclos: ${cycles}`;
        }
    }, seconds * 1000);
}

function stopTimer() {
    if (!isRunning) return;

    // Guardar última sesión antes de limpiar
    lastSession.innerText = `Última: ${formatTime(totalSeconds)} (${cycles} ciclos)`;

    clearInterval(interval);
    clearInterval(timerInterval);
    isRunning = false;
    
    startBtn.innerText = "Iniciar";
    startBtn.style.backgroundColor = "#0984e3";
    breathText.innerText = "Listo";
    breathingCircle.style.animation = 'none';
    
    audioIn.pause();
    audioOut.pause();
}

slider.oninput = () => {
    display.innerText = slider.value;
    if (isRunning) { stopTimer(); startTimer(); }
};

startBtn.onclick = () => isRunning ? stopTimer() : startTimer();