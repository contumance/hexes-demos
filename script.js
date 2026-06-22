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
setInterval(triggerHintGlitch, 4000);

// --- Login Logic (Backend Vercel) ---
async function checkAccess() {
    const passkey = passInput.value.trim();
    if (!passkey) return;

    enterBtn.innerText = '[ CHECKING... ]';
    errorMsg.style.display = 'none';

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ passkey })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            activePlaylist = data.playlist;
            iniciarReproductor();
        } else {
            throw new Error(data.error || 'ACCESS DENIED');
        }
    } catch (err) {
        passInput.value = '';
        passInput.focus();
        errorMsg.innerText = err.message || 'ACCESS DENIED';
        errorMsg.style.display = 'block';
    } finally {
        enterBtn.innerText = '[ ENTER ]';
    }
}

enterBtn.addEventListener('click', checkAccess);
passInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') checkAccess();
});

// --- Player Logic ---
function iniciarReproductor() {
    loginScreen.style.display = 'none';
    playerScreen.style.display = 'flex';
    initVisualizer();
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

    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser();

    // Connect audio element to analyser
    source = audioCtx.createMediaElementSource(audio);
    source.connect(analyser);
    analyser.connect(audioCtx.destination);

    analyser.fftSize = 128; // lower fftSize for thicker bars
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    // Adjust canvas resolution
    canvas.width = canvas.offsetWidth * 2;
    canvas.height = canvas.offsetHeight * 2;

    function draw() {
        requestAnimationFrame(draw);

        analyser.getByteFrequencyData(dataArray);

        canvasCtx.clearRect(0, 0, canvas.width, canvas.height);

        const barWidth = (canvas.width / bufferLength) * 2;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            // Escalar para que no tape más del 40% del alto total del cassette
            barHeight = (dataArray[i] / 255) * (canvas.height * 0.4);

            // Draw retro red bars based on frequency height
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

// --- Share Logic ---
const shareBtn = document.getElementById('share-btn');
if (shareBtn) {
    shareBtn.addEventListener('click', async () => {
        if (!activePlaylist[currentTrackIndex]) return;
        
        const shareData = {
            title: 'HEXES',
            text: `Escuchando ${activePlaylist[currentTrackIndex].title} en el acceso privado de HEXES.`,
            url: window.location.origin
        };

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
