/*
const slider = document.getElementById('time-slider');
const display = document.getElementById('current-time');
const startBtn = document.getElementById('start-btn');
const breathingCircle = document.getElementById('breathing-circle');

let audioContext;
let audioBuffer;
let isRunning = false;
let intervalId;
let isInhaling = true; // Selector para alternar el tono

// 1. Cargar el audio al inicio
async function loadSound() {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const response = await fetch('bong.mp3');
    const arrayBuffer = await response.arrayBuffer();
    audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
}

// 2. Función para reproducir con tono variable
function playBong(pitch) {
    if (!audioBuffer) return;
    
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    
    // Aquí cambiamos el tono: 1.0 es original, < 1.0 es más bajo
    source.playbackRate.value = pitch;
    
    source.connect(audioContext.destination);
    source.start(0);
}

function startTimer() {
    if (audioContext?.state === 'suspended') audioContext.resume();
    
    const seconds = parseFloat(slider.value);
    isRunning = true;
    isInhaling = true; // Empezamos inhalando
    startBtn.innerText = "Detener";
    startBtn.style.backgroundColor = "#e74c3c";

    // Reiniciar animación
    breathingCircle.style.animation = 'none';
    breathingCircle.offsetHeight; 
    breathingCircle.style.animation = `breathe ${seconds}s infinite alternate ease-in-out`;

    // Primer sonido (Agudo - Inhalar)
    playBong(1.0); 
    
    intervalId = setInterval(() => {
        isInhaling = !isInhaling;
        // Si no está inhalando (exhalar), baja el tono a 0.7
        const currentPitch = isInhaling ? 1.0 : 0.7; 
        playBong(currentPitch);
    }, seconds * 1000);
}

function stopTimer() {
    clearInterval(intervalId);
    isRunning = false;
    startBtn.innerText = "Iniciar";
    startBtn.style.backgroundColor = "#0984e3";
    breathingCircle.style.animation = 'none';
}

// Cargar el sonido apenas cargue la página
window.addEventListener('load', loadSound);

startBtn.onclick = () => {
    if (isRunning) {
        stopTimer();
    } else {
        startTimer();
    }
};
*/
///////

// THIS WORKS
const slider = document.getElementById('time-slider');
const display = document.getElementById('current-time');
const startBtn = document.getElementById('start-btn');
const breathingCircle = document.getElementById('breathing-circle');

// Carga tu archivo local
const bongSound = new Audio('bong.mp3'); 

let interval = null;
let isRunning = false;

slider.oninput = () => {
    display.innerText = slider.value;
    if (isRunning) stopTimer();
};

function startTimer() {
    const seconds = parseFloat(slider.value);
    isRunning = true;
    startBtn.innerText = "Detener"; // Cambio de texto
    startBtn.style.backgroundColor = "#e74c3c"; // Opcional: rojo al detener
    
    // La animación ahora dura exactamente lo que el slider diga
    // "alternate" hace que una vez se hinche y la siguiente se deshinche
    breathingCircle.style.animation = `breathe ${seconds}s infinite alternate ease-in-out`;
    
    bongSound.play(); 
    
    interval = setInterval(() => {
        bongSound.currentTime = 0; 
        bongSound.play();
    }, seconds * 1000);
}

function stopTimer() {
    clearInterval(interval);
    isRunning = false;
    
    // Resetear botón
    startBtn.innerText = "Iniciar";
    startBtn.style.backgroundColor = "#0984e3";
    
    // Detener audio
    bongSound.pause();
    bongSound.currentTime = 0;
    
    // Detener animación
    breathingCircle.style.animation = 'none';
}

startBtn.onclick = () => {
    isRunning ? stopTimer() : startTimer();
};

