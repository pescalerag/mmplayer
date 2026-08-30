export function getClientHtml(): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MMPlayer LocalCast</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
            user-select: none;
        }

        body {
            font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            background-color: #0d0f12;
            color: #FFFFFF;
            height: 100vh;
            width: 100vw;
            display: flex;
            align-items: center;
            justify-content: center;
            overflow: hidden;
            position: relative;
        }

        #background-blur {
            position: absolute;
            top: -20px;
            left: -20px;
            right: -20px;
            bottom: -20px;
            background-size: cover;
            background-position: center;
            filter: blur(60px) brightness(0.25) saturate(1.4);
            z-index: 0;
            transition: background-image 0.8s ease-in-out;
            transform: scale(1.05);
        }

        #background-overlay {
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: radial-gradient(circle at center, rgba(13, 15, 18, 0.4) 0%, rgba(13, 15, 18, 0.85) 100%);
            z-index: 1;
        }

        .main-container {
            display: flex;
            flex-direction: row;
            width: 90vw;
            max-width: 1400px;
            height: 85vh;
            background: rgba(22, 27, 34, 0.45);
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            border-radius: 32px;
            padding: 48px;
            gap: 56px;
            box-shadow: 0 30px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            z-index: 2;
            overflow: hidden;
        }

        .left-column {
            flex: 1.1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            height: 100%;
            max-width: 520px;
            gap: 24px;
        }

        .artwork-wrapper {
            position: relative;
            width: 320px;
            height: 320px;
            border-radius: 24px;
            overflow: hidden;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.1);
            flex-shrink: 0;
            background-color: #1a1e24;
        }

        .cover {
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.5s ease;
        }

        .artwork-wrapper:hover .cover {
            transform: scale(1.03);
        }

        .info-wrapper {
            width: 100%;
            text-align: center;
            display: flex;
            flex-direction: column;
            gap: 6px;
        }

        .title {
            font-size: 26px;
            font-weight: 800;
            color: #FFFFFF;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            letter-spacing: -0.5px;
            text-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }

        .artist {
            font-size: 17px;
            font-weight: 600;
            color: #94A3B8;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .player-controls {
            width: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 16px;
        }

        .progress-container {
            width: 100%;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .progress-bar-container {
            width: 100%;
            height: 6px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 6px;
            overflow: hidden;
            position: relative;
        }

        .progress-fill {
            height: 100%;
            width: 0%;
            background: linear-gradient(90deg, #8B5CF6, #EC4899);
            border-radius: 6px;
            transition: width 0.2s linear;
        }

        .time-container {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            font-weight: 600;
            color: #64748B;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            border-radius: 20px;
            background: rgba(139, 92, 246, 0.15);
            border: 1px solid rgba(139, 92, 246, 0.3);
            color: #A78BFA;
            font-size: 13px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }

        .beta-badge {
            display: inline-flex;
            align-items: center;
            padding: 4px 10px;
            border-radius: 8px;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #94A3B8;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
        }

        .right-column {
            flex: 1.5;
            height: 100%;
            position: relative;
            overflow: hidden;
            mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
            -webkit-mask-image: linear-gradient(to bottom, transparent 0%, black 15%, black 85%, transparent 100%);
        }

        .lyrics-scroller {
            display: flex;
            flex-direction: column;
            width: 100%;
            padding: 180px 20px;
            transition: transform 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
        }

        .lyric-line {
            font-size: 24px;
            font-weight: 700;
            line-height: 1.6;
            color: rgba(255, 255, 255, 0.25);
            margin: 12px 0;
            transition: all 0.35s ease;
            text-align: left;
            word-wrap: break-word;
            transform-origin: left center;
        }

        .lyric-line.active {
            color: #FFFFFF;
            font-size: 32px;
            transform: scale(1.05);
            text-shadow: 0 0 30px rgba(139, 92, 246, 0.6), 0 0 10px rgba(255, 255, 255, 0.4);
        }

        @media (max-width: 900px) {
            .main-container {
                flex-direction: column;
                height: 95vh;
                padding: 24px;
                gap: 24px;
            }
            .left-column {
                max-width: 100%;
                gap: 12px;
            }
            .artwork-wrapper {
                width: 180px;
                height: 180px;
            }
            .title { font-size: 20px; }
            .artist { font-size: 15px; }
            .right-column {
                display: none;
            }
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
                <div id="title" class="title">No hay canción</div>
                <div id="artist" class="artist"></div>
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
            </div>
            <audio id="audio-player" preload="auto"></audio>
            <div style="display: flex; flex-direction: row; align-items: center; gap: 8px; align-self: flex-start;">
                <div class="status-badge" id="sync-status">No hay canción</div>
                <div class="beta-badge">MMPlayer</div>
            </div>
        </div>

        <div class="right-column">
            <div id="lyrics-scroller" class="lyrics-scroller">
                <div class="lyric-line" style="text-align: center;">No hay letras cargadas</div>
            </div>
        </div>
    </div>

    <script>
        const audioPlayer      = document.getElementById('audio-player');
        const titleEl          = document.getElementById('title');
        const artistEl         = document.getElementById('artist');
        const coverEl          = document.getElementById('cover');
        const statusEl         = document.getElementById('sync-status');
        const backgroundBlur   = document.getElementById('background-blur');
        const lyricsScroller   = document.getElementById('lyrics-scroller');
        const progressFill     = document.getElementById('progress-fill');
        const timeCurrentEl    = document.getElementById('time-current');
        const timeTotalEl      = document.getElementById('time-total');

        audioPlayer.volume = 1.0;

        let currentSongTitle   = "";
        let isFetchingAudio    = false;
        let lyrics             = [];
        let currentActiveIndex = -1;
        let isAutoplayBlocked  = false;
        let lastActionTime     = 0;
        let currentLyricsLRC   = null;
        let currentCoverToken  = null;

        const FALLBACK_COVER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2'><rect width='20' height='20' x='2' y='2' rx='2'/><circle cx='12' cy='12' r='4'/></svg>";

        function resetToIdle(statusMessage) {
            audioPlayer.pause();
            audioPlayer.removeAttribute('src');
            currentSongTitle   = "";
            currentLyricsLRC   = null;
            currentCoverToken  = null;
            currentActiveIndex = -1;
            
            titleEl.innerText  = "No hay canción";
            artistEl.innerText = "";
            updateCover(null);
            renderLyrics('');
            progressFill.style.width = '0%';
            timeCurrentEl.innerText  = '0:00';
            timeTotalEl.innerText    = '0:00';
            
            statusEl.innerText = statusMessage || "No hay canción";
            statusEl.style.backgroundColor = "rgba(239,68,68,0.2)";
            statusEl.style.color = "#FCA5A5";
            statusEl.style.cursor = "default";
            statusEl.onclick = null;
        }

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
            } catch (err) {
                coverEl.src = FALLBACK_COVER;
                backgroundBlur.style.backgroundImage = "none";
            }
        }

        function parseLRC(lrcText) {
            if (!lrcText) return [];
            const result = [];
            const lines = lrcText.split(/\\r?\\n/);
            const timeTagRegex = /\\[(\\d{1,3}):(\\d{2})(?:[.:](\\d{1,3}))?\\]/g;

            for (const line of lines) {
                if (!line.trim()) continue;
                const times = [];
                let match;
                timeTagRegex.lastIndex = 0;

                while ((match = timeTagRegex.exec(line)) !== null) {
                    const min = parseInt(match[1], 10);
                    const sec = parseInt(match[2], 10);
                    let ms = 0;
                    if (match[3]) {
                        const msStr = match[3].padEnd(3, '0').substring(0, 3);
                        ms = parseInt(msStr, 10);
                    }
                    times.push(min * 60 + sec + ms / 1000);
                }

                const text = line.replace(timeTagRegex, '').trim();
                if (text && times.length > 0) {
                    for (const t of times) {
                        result.push({ time: t, text: text });
                    }
                }
            }
            return result.sort((a, b) => a.time - b.time);
        }

        function formatTime(seconds) {
            if (isNaN(seconds) || seconds === null) return '0:00';
            const mins = Math.floor(seconds / 60);
            const secs = Math.floor(seconds % 60);
            return mins + ':' + (secs < 10 ? '0' : '') + secs;
        }

        function renderLyrics(lrcText) {
            lyrics = parseLRC(lrcText);
            currentActiveIndex = -1;
            lyricsScroller.innerHTML = '';
            lyricsScroller.style.transform = 'translateY(0px)';

            if (lyrics.length === 0) {
                lyricsScroller.innerHTML = '<div class="lyric-line" style="text-align:center;">No hay letras cargadas</div>';
                return;
            }
            lyrics.forEach((item, index) => {
                const div = document.createElement('div');
                div.className = 'lyric-line';
                div.id = 'lyric-' + index;
                div.innerText = item.text;
                lyricsScroller.appendChild(div);
            });
        }

        function syncLyrics(currentTime) {
            if (!lyrics || lyrics.length === 0) return;
            let activeIndex = -1;
            for (let i = 0; i < lyrics.length; i++) {
                if (currentTime >= lyrics[i].time) {
                    activeIndex = i;
                } else {
                    break;
                }
            }

            if (activeIndex === currentActiveIndex) return;
            currentActiveIndex = activeIndex;

            const lines = lyricsScroller.children;
            for (let i = 0; i < lines.length; i++) {
                if (i === activeIndex) {
                    lines[i].classList.add('active');
                    const containerHeight = lyricsScroller.parentElement.clientHeight;
                    const lineOffsetTop  = lines[i].offsetTop;
                    const lineHeight     = lines[i].clientHeight;
                    const targetY        = -(lineOffsetTop - (containerHeight / 2) + (lineHeight / 2));
                    lyricsScroller.style.transform = 'translateY(' + targetY + 'px)';
                } else {
                    lines[i].classList.remove('active');
                }
            }
        }

        function tryPlayAudio() {
            isAutoplayBlocked = false;
            audioPlayer.play().then(() => {
                statusEl.innerText = "Reproduciendo";
                statusEl.style.backgroundColor = "rgba(139,92,246,0.2)";
                statusEl.style.color = "#A78BFA";
                statusEl.style.cursor = "default";
                statusEl.onclick = null;
            }).catch(err => {
                if (err.name === 'NotAllowedError') {
                    isAutoplayBlocked = true;
                    statusEl.innerText = "Haga clic para activar audio";
                    statusEl.style.backgroundColor = "rgba(239,68,68,0.2)";
                    statusEl.style.color = "#FCA5A5";
                    statusEl.style.cursor = "pointer";
                    statusEl.onclick = () => tryPlayAudio();
                }
            });
        }

        document.body.addEventListener('click', () => {
            if (isAutoplayBlocked) {
                tryPlayAudio();
            }
        });

        async function updateState() {
            try {
                const response = await fetch('/api/state');
                if (!response.ok) {
                    throw new Error('Response not OK');
                }
                const state = await response.json();

                if (!state.title || state.isStopped) {
                    resetToIdle("No hay canción");
                    return;
                }

                if (state.coverToken !== currentCoverToken) {
                    updateCover(state.coverToken);
                }

                if (currentSongTitle !== state.title && !isFetchingAudio) {
                    currentSongTitle  = state.title;
                    isFetchingAudio   = true;
                    isAutoplayBlocked = false;
                    lastActionTime    = Date.now();

                    titleEl.innerText  = state.title;
                    artistEl.innerText = state.artist;

                    currentLyricsLRC   = state.lyricsLRC;
                    renderLyrics(state.lyricsLRC);

                    if (state.mediaFileName) {
                        const mediaUrl = '/static/' + state.mediaFileName + '?t=' + Date.now();

                        audioPlayer.removeAttribute('src');
                        audioPlayer.src = mediaUrl;

                        if (state.position > 0) {
                            audioPlayer.currentTime = state.position;
                        }

                        audioPlayer.play().then(() => {
                            statusEl.innerText = "Transmitiendo";
                            statusEl.style.backgroundColor = "rgba(139,92,246,0.2)";
                            statusEl.style.color = "#A78BFA";
                        }).catch(err => {
                            if (err.name === 'NotAllowedError') {
                                isAutoplayBlocked = true;
                                statusEl.innerText = "Clic para activar audio";
                                statusEl.style.backgroundColor = "rgba(239,68,68,0.2)";
                                statusEl.style.color = "#FCA5A5";
                                statusEl.style.cursor = "pointer";
                                statusEl.onclick = () => tryPlayAudio();
                            }
                        });
                    }
                    isFetchingAudio = false;
                } else if (!isFetchingAudio) {
                    if (currentLyricsLRC !== state.lyricsLRC) {
                        currentLyricsLRC = state.lyricsLRC;
                        renderLyrics(state.lyricsLRC);
                        syncLyrics(audioPlayer.currentTime);
                    }

                    if (Date.now() - lastActionTime > 400) {
                        const isNearEnd = audioPlayer.duration && (audioPlayer.currentTime > audioPlayer.duration - 2);
                        const shouldPlay = state.isPlaying && !audioPlayer.ended && !isNearEnd;

                        if (shouldPlay && audioPlayer.paused && !isAutoplayBlocked && !audioPlayer.error) {
                            audioPlayer.play().catch(err => {
                                if (err.name === 'NotAllowedError') {
                                    isAutoplayBlocked = true;
                                    statusEl.innerText = "Clic para activar audio";
                                    statusEl.style.backgroundColor = "rgba(239,68,68,0.2)";
                                    statusEl.style.color = "#FCA5A5";
                                    statusEl.style.cursor = "pointer";
                                    statusEl.onclick = () => tryPlayAudio();
                                }
                            });
                        } else if (!state.isPlaying && !audioPlayer.paused) {
                            audioPlayer.pause();
                        }

                        if (audioPlayer.duration && !audioPlayer.seeking) {
                            const timeDifference = Math.abs(audioPlayer.currentTime - state.position);
                            if (timeDifference > 2) {
                                audioPlayer.currentTime = state.position;
                            }
                        }
                    }

                    if (!isAutoplayBlocked && !audioPlayer.error) {
                        statusEl.innerText = "Transmitiendo";
                        statusEl.style.backgroundColor = "rgba(139,92,246,0.2)";
                        statusEl.style.color = "#A78BFA";
                    }
                }

            } catch (error) {
                resetToIdle("No hay canción");
            }
        }

        audioPlayer.ontimeupdate = () => {
            const current = audioPlayer.currentTime;
            const duration = audioPlayer.duration || 1;
            progressFill.style.width = ((current / duration) * 100) + '%';
            timeCurrentEl.innerText  = formatTime(current);
            timeTotalEl.innerText    = formatTime(duration);
            syncLyrics(current);
        };

        audioPlayer.oncanplay = () => {
            if (!isAutoplayBlocked && audioPlayer.paused) {
                audioPlayer.play().catch(() => {});
            }
        };

        audioPlayer.onended = () => {
            fetch('/api/next', { method: 'POST' }).catch(() => {});
        };

        audioPlayer.onerror = () => {
            const err = audioPlayer.error;
            console.error("[AudioErrorEvent] Audio player error:", err);
            statusEl.innerText = "Reintentando audio...";
            statusEl.style.backgroundColor = "rgba(239,68,68,0.2)";
            statusEl.style.color = "#FCA5A5";
            setTimeout(() => {
                currentSongTitle = "";
                updateState();
            }, 1200);
        };

        setInterval(updateState, 750);
        updateState();
    </script>
</body>
</html>`;
}
