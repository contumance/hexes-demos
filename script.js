let activePlaylist = [];
let currentTrackIndex = 0;
const audio = new Audio();

// DOM Elements
const passInput = document.getElementById('passkey');
const enterBtn = document.getElementById('enter-btn');
const errorMsg = document.getElementById('error-msg');
const loginScreen = document.getElementById('login-screen');
const playerScreen = document.getElementById('player-screen');
const playBtn = document.getElementById('play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const titleDisplay = document.getElementById('current-title');
const lyricsDisplay = document.getElementById('lyrics-text');
const cassetteBg = document.getElementById('cassette-bg');
const playlistPanel = document.getElementById('playlist-panel');

// Progress and Volume Controls
const progressBg = document.getElementById('progress-bg');
const progressFill = document.getElementById('progress-fill');
const currentTimeEl = document.getElementById('current-time');
const totalTimeEl = document.getElementById('total-time');
const volumeSlider = document.getElementById('volume-slider');

// --- Hint Glitch Logic ---
const hintEl = document.getElementById('hint-text');
const hintEN = 'FIND THE RED WORD ON THE CARD';
const hintES = 'BUSCA LA PALABRA ROJA EN LA TARJETA';
let hintLang = 'en';

function triggerHintGlitch() {
    hintEl.classList.add('glitching');
    setTimeout(() => {
        hintLang = hintLang === 'en' ? 'es' : 'en';
        hintEl.textContent = hintLang === 'en' ? hintEN : hintES;
    }, 250);
    hintEl.addEventListener('animationend', () => {
        hintEl.classList.remove('glitching');
    }, { once: true });
}
const hintInterval = setInterval(triggerHintGlitch, 10000);

// --- Login Logic (Bypassed) ---
async function loadDirectly() {
    try {
        const response = await fetch('playlist.json');
        const masterPlaylist = await response.json();
        // Cargar los temas ocultando el primero (DESPERTAR)
        activePlaylist = masterPlaylist.slice(1);
        iniciarReproductor();
    } catch (err) {
        console.error("Error loading playlist:", err);
    }
}

window.addEventListener('DOMContentLoaded', loadDirectly);

// --- Player Logic ---
function iniciarReproductor() {
    clearInterval(hintInterval); // Detener la animación de fondo oculta
    loginScreen.style.display = 'none';
    playerScreen.style.display = 'flex';
    initVisualizer();
    initMediaSession();
    renderPlaylist();
    loadTrack(0);
}

function renderPlaylist() {
    playlistPanel.innerHTML = '';
    activePlaylist.forEach((track, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        item.innerText = `${index + 1}. ${track.title}`;
        item.onclick = () => {
            const wasPlaying = !audio.paused;
            loadTrack(index);
            if (wasPlaying) {
                audio.play();
                updatePlayState();
            }
        };
        playlistPanel.appendChild(item);
    });
}

function updatePlaylistActiveItem() {
    const items = playlistPanel.getElementsByClassName('playlist-item');
    for (let i = 0; i < items.length; i++) {
        if (i === currentTrackIndex) {
            items[i].classList.add('active');
        } else {
            items[i].classList.remove('active');
        }
    }
}

function loadTrack(index) {
    currentTrackIndex = index;
    audio.src = activePlaylist[index].file;
    titleDisplay.innerText = activePlaylist[index].title;
    lyricsDisplay.innerText = activePlaylist[index].lyrics;
    updatePlaylistActiveItem();
    updateMediaSession();
    // Reset progress
    progressFill.style.width = '0%';
    currentTimeEl.innerText = '0:00';
    totalTimeEl.innerText = '0:00';
}

function updatePlayState() {
    if (!audio.paused) {
        playBtn.innerText = "PAUSE";
        cassetteBg.src = "assets/cassette.gif";
    } else {
        playBtn.innerText = "PLAY";
        cassetteBg.src = "assets/cassette_static.png";
    }
}

function togglePlay() {
    if (audio.paused) {
        audio.play();
    } else {
        audio.pause();
    }
    updatePlayState();
}

playBtn.addEventListener('click', togglePlay);

function nextTrack(forcePlay = false) {
    const wasPlaying = !audio.paused;
    currentTrackIndex = (currentTrackIndex + 1) % activePlaylist.length;
    loadTrack(currentTrackIndex);
    if (wasPlaying || forcePlay) {
        audio.play();
    }
    updatePlayState();
}

nextBtn.addEventListener('click', () => nextTrack(false));

function prevTrack() {
    const wasPlaying = !audio.paused;
    currentTrackIndex = (currentTrackIndex - 1 + activePlaylist.length) % activePlaylist.length;
    loadTrack(currentTrackIndex);
    if (wasPlaying) {
        audio.play();
    }
    updatePlayState();
}

prevBtn.addEventListener('click', prevTrack);

// --- Time and Progress Logic ---
function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

audio.addEventListener('loadedmetadata', () => {
    totalTimeEl.innerText = formatTime(audio.duration);
});

audio.addEventListener('timeupdate', () => {
    currentTimeEl.innerText = formatTime(audio.currentTime);
    if (audio.duration) {
        const percent = (audio.currentTime / audio.duration) * 100;
        progressFill.style.width = `${percent}%`;
    }
});

audio.addEventListener('ended', () => {
    nextTrack(true);
});

progressBg.addEventListener('click', (e) => {
    if (!audio.duration) return;
    const rect = progressBg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const percent = clickX / width;
    audio.currentTime = percent * audio.duration;
});

// --- Volume Logic ---
volumeSlider.addEventListener('input', (e) => {
    audio.volume = e.target.value;
});

// --- Analytics (Google Analytics GA4) ---
audio.addEventListener('play', () => {
    if (audioCtx && audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    if (typeof gtag === 'function' && activePlaylist[currentTrackIndex]) {
        gtag('event', 'song_played', {
            'song_title': activePlaylist[currentTrackIndex].title
        });
    }
});

// --- Visualizer (Web Audio API) ---
let audioCtx;
let analyser;
let source;
let isVisualizerInit = false;

const canvas = document.getElementById('visualizer');
const canvasCtx = canvas.getContext('2d');
function initVisualizer() {
    if (isVisualizerInit) return;
    
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    // Ajustar resolución del canvas
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;

    if (isMobile) {
        // --- ECUALIZADOR FALSO PARA MÓVIL ---
        // Los teléfonos cortan el sonido en 2do plano si usamos la Web Audio API.
        // Aquí simulamos visualmente las barras para no perder el efecto ni el sonido.
        const bufferLength = 32;
        let fakeData = new Float32Array(bufferLength);
        
        function drawFake() {
            requestAnimationFrame(drawFake);
            canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (audio.paused) return; 
            
            const barWidth = (canvas.width / bufferLength) * 2;
            let x = 0;
            
            for(let i = 0; i < bufferLength; i++) {
                // Suavizar el valor aleatorio para que se vea natural
                const target = Math.random() * 255;
                fakeData[i] += (target - fakeData[i]) * 0.15; 
                const val = fakeData[i];
                
                // Reducir la altura máxima de las barras simuladas (de 0.4 a 0.2)
                const barHeight = (val / 255) * (canvas.height * 0.2); 
                canvasCtx.fillStyle = 'rgba(180, 8, 8, ' + (val / 255) + ')';
                canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
                x += barWidth + 2;
            }
        }
        drawFake();
        isVisualizerInit = true;
        return;
    }

    // --- ECUALIZADOR REAL PARA PC ---
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();
    
    source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);
    
    analyser.fftSize = 128; 
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    function draw() {
        requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = (canvas.width / bufferLength) * 2;
        let barHeight;
        let x = 0;
        
        for(let i = 0; i < bufferLength; i++) {
            barHeight = (dataArray[i] / 255) * (canvas.height * 0.4); 
            canvasCtx.fillStyle = 'rgba(180, 8, 8, ' + (dataArray[i] / 255) + ')';
            canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
            x += barWidth + 2;
        }
    }
    
    draw();
    isVisualizerInit = true;
}

// --- Glitch Interaction ---
const cassetteContainer = document.querySelector('.cassette-container');
//const cassetteBg = document.getElementById('cassette-bg');

function addGlitch() {
    cassetteBg.classList.add('glitch-active');
}

function removeGlitch() {
    cassetteBg.classList.remove('glitch-active');
}

cassetteContainer.addEventListener('mousedown', addGlitch);
cassetteContainer.addEventListener('mouseup', removeGlitch);
cassetteContainer.addEventListener('mouseleave', removeGlitch);

cassetteContainer.addEventListener('touchstart', addGlitch);
cassetteContainer.addEventListener('touchend', removeGlitch);
cassetteContainer.addEventListener('touchcancel', removeGlitch);

// Evitar que el drag nativo interrumpa el evento
cassetteBg.addEventListener('dragstart', (e) => e.preventDefault());

// --- Media Session API (Background Playback) ---
function initMediaSession() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.setActionHandler('play', togglePlay);
        navigator.mediaSession.setActionHandler('pause', togglePlay);
        navigator.mediaSession.setActionHandler('previoustrack', prevTrack);
        navigator.mediaSession.setActionHandler('nexttrack', () => nextTrack(true));
    }
}

function updateMediaSession() {
    if ('mediaSession' in navigator && activePlaylist[currentTrackIndex]) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: activePlaylist[currentTrackIndex].title,
            artist: 'HEXES',
            album: 'Unreleased Demos',
            artwork: [
                { src: `${window.location.origin}/assets/cassette_static.png`, sizes: '512x512', type: 'image/png' },
                { src: `${window.location.origin}/assets/logo_hexes.png`, sizes: '512x512', type: 'image/png' }
            ]
        });
    }
}

// --- Share Logic ---
const shareBtn = document.getElementById('share-btn');
if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
        if (!activePlaylist[currentTrackIndex]) return;

        const url = window.location.origin;
        const textToShare = `Escuchando ${activePlaylist[currentTrackIndex].title} de HEXES.`;

        let shareData = {
            title: 'HEXES',
            text: textToShare,
            url: url
        };

        try {
            // Generar imagen dinámica con el nombre de la canción usando Canvas
            const bgImg = new Image();
            bgImg.crossOrigin = "anonymous";
            bgImg.src = 'assets/cassette_static.png';
            
            const layerImg = new Image();
            layerImg.crossOrigin = "anonymous";
            layerImg.src = 'assets/cassette_capa_intermedia.png';
            
            await Promise.all([
                new Promise((resolve, reject) => {
                    bgImg.onload = resolve;
                    bgImg.onerror = reject;
                }),
                new Promise((resolve, reject) => {
                    layerImg.onload = resolve;
                    layerImg.onerror = reject;
                })
            ]);

            const shareCanvas = document.createElement('canvas');
            shareCanvas.width = bgImg.width;
            shareCanvas.height = bgImg.height;
            const ctx = shareCanvas.getContext('2d');
            
            // Dibujar fondo (cassette)
            ctx.drawImage(bgImg, 0, 0);
            
            // Dibujar capa intermedia
            ctx.drawImage(layerImg, 0, 0);

            // Proporciones basadas en el tamaño CSS del contenedor (300x190)
            const scaleX = bgImg.width / 300;
            const scaleY = bgImg.height / 190;

            // Configurar tipografía retro (asegúrate de que el nombre coincida)
            ctx.font = `${24 * scaleX}px "VT323", monospace`;
            ctx.fillStyle = '#000000';
            ctx.textBaseline = 'top';

            const trackTitle = activePlaylist[currentTrackIndex].title;
            const fullTitle = `${currentTrackIndex + 1}. ${trackTitle}`;

            // Dibujar el título de la canción en la etiqueta blanca del cassette
            ctx.fillText(fullTitle, 80 * scaleX, 26 * scaleY);

            // Dibujar el texto secundario
            ctx.font = `${14 * scaleX}px "VT323", monospace`;
            ctx.fillText("SIDE A: UNRELEASED MATERIAL", 80 * scaleX, 48 * scaleY);

            // Convertir canvas a Blob (Archivo físico virtual)
            const blob = await new Promise(resolve => shareCanvas.toBlob(resolve, 'image/png'));
            const file = new File([blob], `Hexes_${trackTitle.replace(/\\s+/g, '_')}.png`, { type: 'image/png' });

            const fileShareData = {
                files: [file],
                title: 'HEXES',
                text: textToShare,
            };

            // Verificar si el navegador permite compartir archivos
            if (navigator.canShare && navigator.canShare(fileShareData)) {
                shareData = fileShareData;
            }
        } catch (e) {
            console.error("Error al generar imagen de share:", e);
        }

        if (navigator.share) {
            try {
                await navigator.share(shareData);
            } catch (err) {
                console.error('Error sharing:', err);
            }
        } else {
            alert("Tu dispositivo o navegador no soporta la función de compartir nativa. ¡Copia el enlace arriba!");
        }
    });
}
