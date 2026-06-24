// src/services/LocalCastHtml.ts
// Web client HTML template for MMPlayer Local Cast.
// Separated from LocalCastService.ts to keep service logic clean.

export function getClientHtml(): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <title>MMPlayer Local Cast</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
    <style>
        body {
            margin: 0;
            padding: 0;
            background-color: #0E0E0E;
            color: #FFFFFF;
            font-family: 'Outfit', -apple-system, BlinkMacSystemFont, Roboto, Helvetica, Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            overflow: hidden;
        }
        #background-blur {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background-size: cover;
            background-position: center;
            filter: blur(35px) brightness(0.55);
            transform: scale(1.08);
            z-index: -2;
            transition: background-image 0.5s ease;
        }
        #background-overlay {
            position: fixed;
            top: 0; left: 0; right: 0; bottom: 0;
            background: linear-gradient(180deg, rgba(0,0,0,0.3) 0%, rgba(0,0,0,0.7) 60%, #0E0E0E 100%);
            z-index: -1;
        }
        .main-container {
            display: flex;
            flex-direction: row;
            width: 90%;
            max-width: 1200px;
            height: 85vh;
            gap: 80px;
            align-items: center;
            justify-content: center;
            z-index: 1;
        }
        .left-column {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            text-align: left;
            max-width: 440px;
        }
        .artwork-wrapper {
            position: relative;
            width: 380px;
            height: 380px;
            margin-bottom: 28px;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 20px 50px rgba(0,0,0,0.55);
            background: #1A1A1A;
        }
        .cover {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.5s ease;
        }
        .info-wrapper {
            width: 100%;
            margin-bottom: 20px;
        }
        .title {
            font-size: 30px;
            font-weight: 800;
            color: #FFFFFF;
            margin: 0 0 6px 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            letter-spacing: -0.5px;
        }
        .artist {
            font-size: 18px;
            font-weight: 600;
            color: rgba(255,255,255,0.60);
            margin: 0;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .player-controls {
            width: 100%;
            padding: 20px 0;
            box-sizing: border-box;
            margin-bottom: 20px;
        }
        .progress-container { width: 100%; margin-bottom: 15px; }
        .progress-bar-container {
            width: 100%;
            height: 4px;
            border-radius: 2px;
            background: rgba(255,255,255,0.15);
            position: relative;
            overflow: hidden;
        }
        .progress-fill {
            height: 100%;
            width: 0%;
            background: #FFFFFF;
            transition: width 0.1s linear;
        }
        .time-container {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            color: rgba(255,255,255,0.5);
            font-weight: 600;
            margin-top: 8px;
        }
        .buttons-container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            width: 100%;
        }
        .play-pause-btn {
            background: #FFFFFF;
            color: #0E0E0E;
            border: none;
            width: 48px;
            height: 48px;
            border-radius: 50%;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            box-shadow: 0 4px 12px rgba(255,255,255,0.25);
        }
        .play-pause-btn:hover { transform: scale(1.08); box-shadow: 0 4px 16px rgba(255,255,255,0.4); }
        .play-pause-btn svg { width: 22px; height: 22px; }
        .volume-container {
            display: flex;
            align-items: center;
            gap: 10px;
            background: rgba(255,255,255,0.05);
            padding: 8px 14px;
            border-radius: 30px;
            border: 1px solid rgba(255,255,255,0.03);
        }
        .volume-icon { width: 18px; height: 18px; color: rgba(255,255,255,0.7); }
        .volume-bar {
            -webkit-appearance: none;
            appearance: none;
            width: 80px;
            height: 4px;
            border-radius: 2px;
            background: rgba(255,255,255,0.2);
            outline: none;
            cursor: pointer;
        }
        .volume-bar::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: #FFFFFF;
            cursor: pointer;
        }
        .right-column {
            flex: 1.2;
            height: 90%;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            position: relative;
            mask-image: linear-gradient(to bottom, transparent 0%, white 15%, white 85%, transparent 100%);
            -webkit-mask-image: linear-gradient(to bottom, transparent 0%, white 15%, white 85%, transparent 100%);
        }
        .lyrics-scroller {
            overflow-y: hidden;
            height: 100%;
            padding: 300px 0;
            scrollbar-width: none;
            scroll-behavior: smooth;
        }
        .lyrics-scroller::-webkit-scrollbar { display: none; }
        .lyric-line {
            font-size: 22px;
            font-weight: 700;
            color: rgba(255,255,255,0.35);
            padding: 18px 0;
            transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
            cursor: default;
            user-select: none;
            -webkit-user-select: none;
            pointer-events: none;
            text-align: left;
            line-height: 1.4;
            transform-origin: left center;
        }
        .lyric-line.active {
            color: #FFFFFF;
            font-size: 30px;
            font-weight: 800;
            text-shadow: 0 0 15px rgba(255,255,255,0.35);
        }
        .status-badge {
            display: inline-block;
            padding: 6px 12px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 700;
            background-color: rgba(139,92,246,0.2);
            color: #A78BFA;
            text-transform: uppercase;
            letter-spacing: 1px;
            align-self: flex-start;
        }
        .beta-badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 8px;
            font-size: 9px;
            font-weight: 800;
            background-color: rgba(245, 158, 11, 0.15);
            color: #F59E0B;
            border: 1px solid rgba(245, 158, 11, 0.25);
            text-transform: uppercase;
            letter-spacing: 0.8px;
        }
        @media (max-width: 900px) {
            .main-container {
                flex-direction: column;
                height: 95vh;
                padding-top: 40px;
                gap: 40px;
                overflow-y: auto;
            }
            .left-column { max-width: 100%; align-items: center; text-align: center; }
            .artwork-wrapper { width: 280px; height: 280px; }
            .title, .artist { text-align: center; }
            .lyric-line { text-align: center; transform-origin: center center; }
            .right-column { width: 100%; height: 400px; flex: none; }
        }
    </style>
</head>
<body>
    <div id="background-blur"></div>
    <div id="background-overlay"></div>

    <div class="main-container">
        <div class="left-column">
            <div class="artwork-wrapper">
                <img id="cover" class="cover" src="" alt="Album Cover">
            </div>
            <div class="info-wrapper">
                <div id="title" class="title">Buscando canción...</div>
                <div id="artist" class="artist">Artista</div>
            </div>
            <div class="player-controls">
                <div class="progress-container">
                    <div class="progress-bar-container">
                        <div id="progress-fill" class="progress-fill"></div>
                    </div>
                    <div class="time-container">
                        <span id="time-current">0:00</span>
                        <span id="time-total">0:00</span>
                    </div>
                </div>
                <div class="buttons-container">
                    <button id="btn-play-pause" class="play-pause-btn" aria-label="Play/Pause">
                        <svg id="svg-play" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        <svg id="svg-pause" viewBox="0 0 24 24" fill="currentColor" style="display:none;"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
                    </button>
                    <div class="volume-container">
                        <svg class="volume-icon" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>
                        <input type="range" id="volume-bar" class="volume-bar" min="0" max="1" step="0.05" value="0.8">
                    </div>
                </div>
            </div>
            <audio id="audio-player" style="display: none;"></audio>
            <div style="display: flex; flex-direction: row; align-items: center; gap: 8px; align-self: flex-start;">
                <div class="status-badge" id="sync-status">Sincronizando...</div>
                <div class="beta-badge">BETA</div>
            </div>
        </div>

        <div class="right-column">
            <div id="lyrics-scroller" class="lyrics-scroller">
                <div class="lyric-line" style="text-align: center;">No hay letras cargadas</div>
            </div>
        </div>
    </div>

    <script>
        const audioPlayer    = document.getElementById('audio-player');
        const titleEl        = document.getElementById('title');
        const artistEl       = document.getElementById('artist');
        const coverEl        = document.getElementById('cover');
        const statusEl       = document.getElementById('sync-status');
        const backgroundBlur = document.getElementById('background-blur');
        const lyricsScroller = document.getElementById('lyrics-scroller');
        const progressFill   = document.getElementById('progress-fill');
        const timeCurrentEl  = document.getElementById('time-current');
        const timeTotalEl    = document.getElementById('time-total');
        const playPauseBtn   = document.getElementById('btn-play-pause');
        const svgPlay        = document.getElementById('svg-play');
        const svgPause       = document.getElementById('svg-pause');
        const volumeBar      = document.getElementById('volume-bar');

        audioPlayer.volume = volumeBar.value;

        // ─── State ──────────────────────────────────────────────────────────────
        let currentSongTitle   = "";
        let isFetchingAudio    = false;
        let lyrics             = [];
        let isUserSeeking      = false;
        let currentBlobUrl     = null;
        let isAutoplayBlocked  = false;
        let lastActionTime     = 0;
        let currentLyricsLRC   = null;

        // Cover is fetched once via /api/cover when coverToken changes.
        // This avoids embedding base64 in every /api/state poll response.
        let currentCoverToken  = null;
        const FALLBACK_COVER   = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2'><rect width='20' height='20' x='2' y='2' rx='2'/><circle cx='12' cy='12' r='4'/></svg>";

        // ─── Cover fetcher ───────────────────────────────────────────────────────
        async function updateCover(token) {
            if (token === currentCoverToken) return;
            currentCoverToken = token;
            if (!token) {
                coverEl.src = FALLBACK_COVER;
                backgroundBlur.style.backgroundImage = "none";
                return;
            }
            try {
                const resp = await fetch('/api/cover');
                const data = await resp.json();
                if (data.cover) {
                    coverEl.src = data.cover;
                    backgroundBlur.style.backgroundImage = "url('" + data.cover + "')";
                } else {
                    coverEl.src = FALLBACK_COVER;
                    backgroundBlur.style.backgroundImage = "none";
                }
            } catch {
                coverEl.src = FALLBACK_COVER;
                backgroundBlur.style.backgroundImage = "none";
            }
        }

        // ─── Utilities ───────────────────────────────────────────────────────────
        function parseLRC(lrcText) {
            if (!lrcText) return [];
            const lines = lrcText.split('\\n');
            const timeRegex = /\\[(\\d+):(\\d+(?:\\.\\d+)?)\\]/;
            const parsed = [];
            for (let line of lines) {
                line = line.trim();
                const match = timeRegex.exec(line);
                if (match) {
                    const minutes = parseInt(match[1], 10);
                    const seconds = parseFloat(match[2]);
                    const time = minutes * 60 + seconds;
                    const text = line.replace(timeRegex, '').trim();
                    parsed.push({ time, text });
                }
            }
            return parsed.sort((a, b) => a.time - b.time);
        }

        function renderLyrics(lrcText) {
            lyricsScroller.innerHTML = "";
            lyrics = parseLRC(lrcText);
            if (lyrics.length === 0) {
                const lines = lrcText ? lrcText.split('\\n') : ["No hay letras sincronizadas disponibles"];
                lines.forEach(line => {
                    const div = document.createElement('div');
                    div.className = 'lyric-line';
                    div.style.textAlign = 'center';
                    div.style.color = 'rgba(255,255,255,0.6)';
                    div.style.opacity = '0.8';
                    div.innerText = line;
                    lyricsScroller.appendChild(div);
                });
                return;
            }
            lyrics.forEach((line, idx) => {
                const div = document.createElement('div');
                div.className = 'lyric-line';
                div.id = 'line-' + idx;
                div.innerText = line.text;
                lyricsScroller.appendChild(div);
            });
        }

        function syncLyrics(currentTime) {
            if (lyrics.length === 0) return;
            let activeIdx = -1;
            for (let i = 0; i < lyrics.length; i++) {
                if (currentTime >= lyrics[i].time) { activeIdx = i; } else { break; }
            }
            const lines = document.getElementsByClassName('lyric-line');
            for (let i = 0; i < lines.length; i++) {
                if (i === activeIdx) {
                    if (!lines[i].classList.contains('active')) {
                        lines[i].classList.add('active');
                        lines[i].scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                } else {
                    lines[i].classList.remove('active');
                }
            }
        }

        function formatTime(seconds) {
            if (isNaN(seconds) || seconds === Infinity) return "0:00";
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return mins + ":" + (secs < 10 ? "0" : "") + secs;
        }

        function setUIPlaying(isPlaying) {
            if (isPlaying) {
                svgPlay.style.display  = 'none';
                svgPause.style.display = 'block';
            } else {
                svgPlay.style.display  = 'block';
                svgPause.style.display = 'none';
            }
        }

        function tryPlayAudio() {
            isAutoplayBlocked = false;
            audioPlayer.play().then(() => {
                statusEl.innerText = "Casteando";
                statusEl.style.backgroundColor = "rgba(139,92,246,0.2)";
                statusEl.style.color = "#A78BFA";
                statusEl.style.cursor = "default";
                statusEl.onclick = null;
                fetch('/api/play', { method: 'POST' });
            }).catch(err => {
                if (err.name === 'NotAllowedError') {
                    isAutoplayBlocked = true;
                    statusEl.innerText = "Haga clic para escuchar";
                    statusEl.style.backgroundColor = "rgba(239,68,68,0.2)";
                    statusEl.style.color = "#FCA5A5";
                    statusEl.style.cursor = "pointer";
                    statusEl.onclick = () => tryPlayAudio();
                }
            });
        }

        // ─── Main polling function ───────────────────────────────────────────────
        async function updateState() {
            try {
                const response = await fetch('/api/state');
                const state    = await response.json();

                // No active track
                if (!state.title) {
                    titleEl.innerText = "No hay reproducción activa";
                    artistEl.innerText = "";
                    updateCover(null);
                    lyricsScroller.innerHTML = '<div class="lyric-line" style="text-align:center;">No hay letras cargadas</div>';
                    return;
                }

                // Cover: fetch once per token change via dedicated /api/cover endpoint.
                // This is non-blocking; the cover appears after the first successful fetch.
                if (state.coverToken !== currentCoverToken) {
                    updateCover(state.coverToken); // async, fire-and-forget
                }

                // Track changed → reload audio
                if (currentSongTitle !== state.title && !isFetchingAudio) {
                    currentSongTitle = state.title;
                    isFetchingAudio  = true;
                    isAutoplayBlocked = false;
                    lastActionTime = Date.now(); // Cooldown sync to allow initial media loading
                    statusEl.innerText = "Conectando al Servidor de Medios...";

                    titleEl.innerText  = state.title;
                    artistEl.innerText = state.artist;

                    currentLyricsLRC   = state.lyricsLRC;
                    renderLyrics(state.lyricsLRC);

                    if (state.mediaFileName) {
                        const hostIp   = window.location.hostname;
                        const mediaPort = window.location.port || '8080';
                        const mediaUrl = 'http://' + hostIp + ':' + mediaPort + '/static/' + state.mediaFileName + '?t=' + Date.now();

                        audioPlayer.removeAttribute('src');
                        audioPlayer.src = mediaUrl;
                        audioPlayer.load();

                        if (state.position > 0) {
                            audioPlayer.currentTime = state.position;
                        }

                        const playOnLoad = state.playIntent || state.isPlaying;
                        setUIPlaying(playOnLoad);
                        if (playOnLoad) {
                            tryPlayAudio();
                        } else {
                            statusEl.innerText = "Casteando";
                        }
                    }
                    isFetchingAudio = false;
                } else if (!isFetchingAudio) {
                    // Si las letras se cargaron después en el móvil, actualizarlas en el cast
                    if (currentLyricsLRC !== state.lyricsLRC) {
                        currentLyricsLRC = state.lyricsLRC;
                        renderLyrics(state.lyricsLRC);
                        syncLyrics(audioPlayer.currentTime);
                    }

                    if (Date.now() - lastActionTime > 3000) {
                        const isNearEnd = audioPlayer.duration && (audioPlayer.currentTime > audioPlayer.duration - 3);
                        const shouldPlay = state.isPlaying && !audioPlayer.ended && !isNearEnd;

                        setUIPlaying(state.isPlaying);
                        if (shouldPlay && audioPlayer.paused && !isAutoplayBlocked && !audioPlayer.error) {
                            audioPlayer.play().catch(err => {
                                if (err.name === 'NotAllowedError') {
                                    isAutoplayBlocked = true;
                                    statusEl.innerText = "Haga clic para sincronizar";
                                    statusEl.style.backgroundColor = "rgba(239,68,68,0.2)";
                                    statusEl.style.color = "#FCA5A5";
                                    statusEl.style.cursor = "pointer";
                                    statusEl.onclick = () => tryPlayAudio();
                                }
                            });
                        } else if (!state.isPlaying && !audioPlayer.paused) {
                            audioPlayer.pause();
                        }
                        if (!isUserSeeking && audioPlayer.duration && !audioPlayer.seeking) {
                            const timeDifference = Math.abs(audioPlayer.currentTime - state.position);
                            if (timeDifference > 3) {
                                audioPlayer.currentTime = state.position;
                                lastActionTime = Date.now(); // Cooldown sync while processing seek to avoid reload loops
                            }
                        }
                    }
                    statusEl.innerText = "Casteando";
                }

            } catch (error) {
                console.error("Error polling state:", error);
                // Server offline — stop audio immediately so cached audio doesn't keep playing
                if (!audioPlayer.paused) { audioPlayer.pause(); }
                audioPlayer.removeAttribute('src');
                audioPlayer.load();
                currentSongTitle = "";
                setUIPlaying(false);
                updateCover(null);
                progressFill.style.width = '0%';
                timeCurrentEl.innerText  = "0:00";
                timeTotalEl.innerText    = "0:00";
                titleEl.innerText        = "Servidor desconectado";
                artistEl.innerText       = "";
                statusEl.innerText       = "Desconectado";
                statusEl.style.backgroundColor = "rgba(239,68,68,0.15)";
                statusEl.style.color     = "#FCA5A5";
                statusEl.style.cursor    = "default";
                statusEl.onclick         = null;
            }
        }

        // ─── Audio event handlers ────────────────────────────────────────────────
        audioPlayer.ontimeupdate = () => {
            if (!isUserSeeking) {
                const current  = audioPlayer.currentTime;
                const duration = audioPlayer.duration || 1;
                progressFill.style.width = ((current / duration) * 100) + '%';
                timeCurrentEl.innerText  = formatTime(current);
                timeTotalEl.innerText    = formatTime(duration);
                syncLyrics(current);
            }
        };
        audioPlayer.onplay    = () => { setUIPlaying(true);  console.log("[AudioEvent] play"); };
        audioPlayer.onpause   = () => { setUIPlaying(false); console.log("[AudioEvent] pause"); };
        audioPlayer.onerror   = () => {
            const err = audioPlayer.error;
            console.error("[AudioErrorEvent] Audio player error:", {
                code: err ? err.code : 'unknown',
                message: err ? err.message : 'no message',
                src: audioPlayer.src
            });
            statusEl.innerText = "Error de audio (Clic para reintentar)";
            statusEl.style.backgroundColor = "rgba(239,68,68,0.2)";
            statusEl.style.color  = "#FCA5A5";
            statusEl.style.cursor = "pointer";
            statusEl.onclick = () => {
                console.log("[ClientCast] User clicked retry for Audio Error");
                currentSongTitle = ""; // Force reload
                updateState();
            };
        };
        audioPlayer.onloadstart      = () => console.log("[AudioEvent] loadstart, src:", audioPlayer.src);
        audioPlayer.ondurationchange = () => console.log("[AudioEvent] durationchange:", audioPlayer.duration);
        audioPlayer.onloadedmetadata = () => console.log("[AudioEvent] loadedmetadata, readyState:", audioPlayer.readyState);
        audioPlayer.onloadeddata     = () => console.log("[AudioEvent] loadeddata, readyState:", audioPlayer.readyState);
        audioPlayer.oncanplay        = () => console.log("[AudioEvent] canplay");
        audioPlayer.onplaying        = () => console.log("[AudioEvent] playing");
        audioPlayer.onwaiting        = () => console.log("[AudioEvent] waiting (buffering)");
        audioPlayer.onstalled        = () => console.log("[AudioEvent] stalled");
        audioPlayer.onended          = () => console.log("[AudioEvent] ended");

        // ─── User controls ───────────────────────────────────────────────────────
        playPauseBtn.onclick = () => {
            const isPlaying = !audioPlayer.paused;
            lastActionTime = Date.now();
            if (isPlaying) {
                audioPlayer.pause();
                setUIPlaying(false);
                fetch('/api/pause', { method: 'POST' }).catch(err => console.error("Error sending pause:", err));
            } else {
                audioPlayer.play().catch(() => {});
                setUIPlaying(true);
                fetch('/api/play', { method: 'POST' }).catch(err => console.error("Error sending play:", err));
            }
        };

        volumeBar.oninput = () => { audioPlayer.volume = volumeBar.value; };

        // ─── Start polling ───────────────────────────────────────────────────────
        setInterval(updateState, 1500);
        updateState();
    </script>
</body>
</html>`;
}
