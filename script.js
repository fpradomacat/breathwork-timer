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

// Función para asegurar que el audio suene desde el inicio sin lag
function playSound(audio) {
    audio.pause();
    audio.currentTime = 0;
    // El volumen se actualiza justo antes de sonar por si se movió el slider
    audio.volume = volSlider.value;
    
    // Usamos una promesa para evitar errores de carga
    const playPromise = audio.play();
    if (playPromise !== undefined) {
        playPromise.catch(error => console.log("Error al reproducir:", error));
    }
}

function updateVolume() {
    audioIn.volume = volSlider.value;
    audioOut.volume = volSlider.value;
}

function startTimer() {
    const seconds = parseFloat(slider.value);
    isRunning = true;
    isInhaling = true;
    startBtn.innerText = "Detener";
    startBtn.style.backgroundColor = "#e74c3c";

    // Reiniciar visuales
    breathingCircle.style.animation = 'none';
    breathingCircle.offsetHeight; // Truco de reflow para reiniciar la animación
    breathingCircle.style.animation = `breathe ${seconds}s infinite alternate ease-in-out`;
    
    breathText.innerText = "Inhala";
    
    // Disparar el primer sonido inmediatamente
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
    breathingCircle.style.animation = 'none';
    audioIn.pause();
    audioOut.pause();
}

// Lógica para reiniciar al mover el slider
slider.oninput = () => {
    display.innerText = slider.value;
    if (isRunning) {
        stopTimer();
        startTimer(); // Reinicia con la nueva frecuencia automáticamente
    }
};

startBtn.onclick = () => isRunning ? stopTimer() : startTimer();
volSlider.oninput = updateVolume;