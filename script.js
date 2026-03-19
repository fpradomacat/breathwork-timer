const slider = document.getElementById('time-slider');
const volSlider = document.getElementById('volume-slider');
const display = document.getElementById('current-time');
const breathText = document.getElementById('breath-text');
const startBtn = document.getElementById('start-btn');
const breathingCircle = document.getElementById('breathing-circle');

const audioIn = new Audio('inhala.mp3');
const audioOut = new Audio('exhala.mp3');

let interval = null;
let isRunning = false;
let isInhaling = true;

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
    startBtn.innerText = "Detener";
    startBtn.style.backgroundColor = "#e74c3c";

    // Iniciamos la animación que va del 15% al 100%
    breathingCircle.style.animation = 'none';
    breathingCircle.offsetHeight; 
    breathingCircle.style.animation = `breathe ${seconds}s infinite alternate cubic-bezier(0.45, 0.05, 0.55, 0.95)`;
    
    breathText.innerText = "Inhala";
    playSound(audioIn);

    interval = setInterval(() => {
        isInhaling = !isInhaling;
        if (isInhaling) {
            breathText.innerText = "Inhala";
            playSound(audioIn);
        } else {
            breathText.innerText = "Exhala";
            playSound(audioOut);
        }
    }, seconds * 1000);
}

function stopTimer() {
    clearInterval(interval);
    isRunning = false;
    startBtn.innerText = "Iniciar";
    startBtn.style.backgroundColor = "#0984e3";
    breathText.innerText = "Listo";
    
    // Al detener, vuelve automáticamente al 15% (definido en CSS)
    breathingCircle.style.animation = 'none';
    
    audioIn.pause();
    audioOut.pause();
}

slider.oninput = () => {
    display.innerText = slider.value;
    if (isRunning) { stopTimer(); startTimer(); }
};

startBtn.onclick = () => isRunning ? stopTimer() : startTimer();