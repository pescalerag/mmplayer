export interface LocalCastTranslations {
    appTitle?: string;
    noSong?: string;
    noLyrics?: string;
    streaming?: string;
    playing?: string;
    retryingAudio?: string;
    clickToUnmute?: string;
    clickToUnmuteLong?: string;
    brandName?: string;
    lang?: string;
}

export function getClientHtml(customTranslations?: Partial<LocalCastTranslations>): string {
    const t: LocalCastTranslations = {
        appTitle: 'MMPlayer LocalCast',
        noSong: 'No hay canción',
        noLyrics: 'No hay letras cargadas',
        streaming: 'Transmitiendo',
        playing: 'Reproduciendo',
        retryingAudio: 'Reintentando audio...',
        clickToUnmute: 'Clic para activar audio',
        clickToUnmuteLong: 'Haga clic para activar audio',
        brandName: 'MMPlayer',
        lang: 'es',
        ...customTranslations,
    };

    return `<!DOCTYPE html>
<html lang="${t.lang || 'es'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t.appTitle}</title>
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
            transition: max-width 0.45s cubic-bezier(0.2, 0.8, 0.2, 1), padding 0.45s ease;
        }

        .main-container.no-lyrics {
            max-width: 560px;
            justify-content: center;
            align-items: center;
            padding: 48px 40px;
            gap: 0;
        }

        .main-container.no-lyrics .right-column {
            display: none;
        }

        .main-container.no-lyrics .left-column {
            flex: 1;
            max-width: 100%;
            width: 100%;
            align-items: center;
        }

        .main-container.no-lyrics .artwork-wrapper {
            width: 340px;
            height: 340px;
        }

        .main-container.no-lyrics .status-wrapper {
            align-self: center !important;
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
            transition: all 0.45s ease;
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
            transition: width 0.45s ease, height 0.45s ease;
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
            background: #FFFFFF;
            border-radius: 6px;
            transition: width 0.2s linear;
            box-shadow: 0 0 10px rgba(255, 255, 255, 0.4);
        }

        .time-container {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            font-weight: 600;
            color: #64748B;
        }

        .volume-container {
            width: 100%;
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 4px 0;
            margin-top: 2px;
        }

        .volume-btn {
            background: transparent;
            border: none;
            color: #94A3B8;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 6px;
            border-radius: 8px;
            transition: color 0.2s, background-color 0.2s;
        }

        .volume-btn:hover {
            color: #FFFFFF;
            background: rgba(255, 255, 255, 0.08);
        }

        .volume-slider-wrapper {
            flex: 1;
            display: flex;
            align-items: center;
            position: relative;
        }

        .volume-slider {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 6px;
            border-radius: 6px;
            background: rgba(255, 255, 255, 0.12);
            outline: none;
            cursor: pointer;
            position: relative;
            transition: background 0.2s;
        }

        .volume-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #FFFFFF;
            cursor: pointer;
            box-shadow: 0 0 8px rgba(0, 0, 0, 0.5), 0 0 4px rgba(255, 255, 255, 0.6);
            transition: transform 0.15s ease, background 0.2s ease;
        }

        .volume-slider:hover::-webkit-slider-thumb {
            transform: scale(1.25);
            background: #A78BFA;
        }

        .volume-slider::-moz-range-thumb {
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #FFFFFF;
            border: none;
            cursor: pointer;
            box-shadow: 0 0 8px rgba(0, 0, 0, 0.5);
            transition: transform 0.15s ease;
        }

        .volume-slider:hover::-moz-range-thumb {
            transform: scale(1.25);
            background: #A78BFA;
        }

        .volume-percent {
            font-size: 12px;
            font-weight: 700;
            color: #64748B;
            min-width: 38px;
            text-align: right;
            font-variant-numeric: tabular-nums;
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

        .brand-badge {
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
                <div id="title" class="title">${t.noSong}</div>
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
                <div class="volume-container">
                    <button id="volume-btn" class="volume-btn" aria-label="Volumen" title="Silenciar / Activar sonido">
                        <svg id="vol-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    </button>
                    <div class="volume-slider-wrapper">
                        <input id="volume-slider" type="range" min="0" max="1" step="0.01" value="1" class="volume-slider">
                    </div>
                    <span id="volume-percent" class="volume-percent">100%</span>
                </div>
            </div>
            <audio id="audio-player" preload="auto"></audio>
            <div class="status-wrapper" style="display: flex; flex-direction: row; align-items: center; gap: 8px; align-self: flex-start;">
                <div class="status-badge" id="sync-status">${t.noSong}</div>
                <div class="brand-badge">${t.brandName}</div>
            </div>
        </div>

        <div class="right-column">
            <div id="lyrics-scroller" class="lyrics-scroller">
                <div class="lyric-line" style="text-align: center;">${t.noLyrics}</div>
            </div>
        </div>
    </div>

    <script>
        const i18n             = ${JSON.stringify(t)};
        const mainContainer    = document.querySelector('.main-container');
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
        const volumeSlider     = document.getElementById('volume-slider');
        const volumePercent    = document.getElementById('volume-percent');
        const volumeBtn        = document.getElementById('volume-btn');
        const volIcon          = document.getElementById('vol-icon');

        // Local browser-only volume persistence
        let savedVol = localStorage.getItem('mmplayer_cast_volume');
        let initialVolume = savedVol !== null ? parseFloat(savedVol) : 1.0;
        if (isNaN(initialVolume) || initialVolume < 0 || initialVolume > 1) {
            initialVolume = 1.0;
        }
        audioPlayer.volume = initialVolume;
        volumeSlider.value = initialVolume;
        let lastNonZeroVolume = initialVolume > 0 ? initialVolume : 1.0;
        updateVolumeUI(initialVolume);

        function updateVolumeUI(vol) {
            const pct = Math.round(vol * 100);
            volumePercent.innerText = pct + '%';
            const percentage = vol * 100;
            volumeSlider.style.background = 'linear-gradient(to right, #FFFFFF ' + percentage + '%, rgba(255, 255, 255, 0.12) ' + percentage + '%)';

            if (vol === 0) {
                volIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>';
                volumeBtn.style.color = '#EF4444';
            } else if (vol < 0.5) {
                volIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
                volumeBtn.style.color = '#94A3B8';
            } else {
                volIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
                volumeBtn.style.color = '#94A3B8';
            }
        }

        volumeSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            audioPlayer.volume = val;
            if (val > 0) lastNonZeroVolume = val;
            localStorage.setItem('mmplayer_cast_volume', val.toString());
            updateVolumeUI(val);
        });

        volumeBtn.addEventListener('click', () => {
            if (audioPlayer.volume > 0) {
                lastNonZeroVolume = audioPlayer.volume;
                audioPlayer.volume = 0;
                volumeSlider.value = 0;
                localStorage.setItem('mmplayer_cast_volume', '0');
                updateVolumeUI(0);
            } else {
                const target = lastNonZeroVolume || 1.0;
                audioPlayer.volume = target;
                volumeSlider.value = target;
                localStorage.setItem('mmplayer_cast_volume', target.toString());
                updateVolumeUI(target);
            }
        });

        let currentSongTitle   = "";
        let isFetchingAudio    = false;
        let lyrics             = [];
        let currentActiveIndex = -1;
        let isAutoplayBlocked  = false;
        let lastActionTime     = 0;
        let currentLyricsLRC   = null;
        let currentCoverToken  = null;
        let pollTimeoutId      = null;

        const FALLBACK_COVER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2'><rect width='20' height='20' x='2' y='2' rx='2'/><circle cx='12' cy='12' r='4'/></svg>";

        function scheduleNextPoll(delayMs) {
            if (pollTimeoutId) {
                clearTimeout(pollTimeoutId);
            }
            pollTimeoutId = setTimeout(() => {
                updateState();
            }, delayMs);
        }

        function triggerImmediateUpdate() {
            if (pollTimeoutId) {
                clearTimeout(pollTimeoutId);
                pollTimeoutId = null;
            }
            updateState();
        }

        function resetToIdle(statusMessage) {
            audioPlayer.pause();
            audioPlayer.removeAttribute('src');
            currentSongTitle   = "";
            currentLyricsLRC   = null;
            currentCoverToken  = null;
            currentActiveIndex = -1;
            
            titleEl.innerText  = i18n.noSong;
            artistEl.innerText = "";
            updateCover(null);
            renderLyrics('');
            progressFill.style.width = '0%';
            timeCurrentEl.innerText  = '0:00';
            timeTotalEl.innerText    = '0:00';
            
            statusEl.innerText = statusMessage || i18n.noSong;
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
                const resp = await fetch('/api/cover?token=' + encodeURIComponent(token));
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

            if (!lyrics || lyrics.length === 0) {
                mainContainer.classList.add('no-lyrics');
                return;
            }
            mainContainer.classList.remove('no-lyrics');
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
                statusEl.innerText = i18n.playing;
                statusEl.style.backgroundColor = "rgba(139,92,246,0.2)";
                statusEl.style.color = "#A78BFA";
                statusEl.style.cursor = "default";
                statusEl.onclick = null;
            }).catch(err => {
                if (err.name === 'NotAllowedError') {
                    isAutoplayBlocked = true;
                    statusEl.innerText = i18n.clickToUnmuteLong;
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
        let isPolling = false; // Re-entrancy guard — prevents concurrent updateState calls

        async function updateState() {
            // If already running, skip this tick — next scheduleNextPoll will retry
            if (isPolling) return;
            isPolling = true;

            let nextPollInterval = 2500;
            try {
                const controller = new AbortController();
                const timeoutId  = setTimeout(() => controller.abort(), 4000); // 4s hard timeout

                let response;
                try {
                    response = await fetch('/api/state', { signal: controller.signal });
                } finally {
                    clearTimeout(timeoutId);
                }

                if (!response.ok) throw new Error('Response not OK: ' + response.status);

                const state = await response.json();

                // ── Idle / stopped ────────────────────────────────────────────
                if (!state.title || state.isStopped) {
                    isFetchingAudio = false; // Always reset on idle
                    resetToIdle(i18n.noSong);
                    nextPollInterval = 2000;
                    return;
                }

                // ── Cover (non-blocking, best-effort retry) ───────────────────
                if (state.coverToken && state.coverToken !== currentCoverToken) {
                    updateCover(state.coverToken); // fire-and-forget; updateCover guards dedup internally
                }

                // ── New song loaded ───────────────────────────────────────────
                if (currentSongTitle !== state.title && !isFetchingAudio) {
                    isFetchingAudio = true;
                    try {
                        currentSongTitle  = state.title;
                        isAutoplayBlocked = false;
                        lastActionTime    = Date.now();

                        titleEl.innerText  = state.title;
                        artistEl.innerText = state.artist || '';

                        // Lyrics
                        if (currentLyricsLRC !== state.lyricsLRC) {
                            currentLyricsLRC = state.lyricsLRC;
                            renderLyrics(state.lyricsLRC);
                        }

                        // Audio
                        if (state.mediaFileName) {
                            const mediaUrl = '/static/' + state.mediaFileName + '?t=' + Date.now();
                            audioPlayer.removeAttribute('src');
                            audioPlayer.src = mediaUrl;
                            if (state.position > 1) {
                                audioPlayer.currentTime = state.position;
                            }
                            audioPlayer.play().then(() => {
                                statusEl.innerText = i18n.streaming;
                                statusEl.style.backgroundColor = "rgba(139,92,246,0.2)";
                                statusEl.style.color = "#A78BFA";
                                statusEl.style.cursor = "default";
                                statusEl.onclick = null;
                            }).catch(err => {
                                if (err.name === 'NotAllowedError') {
                                    isAutoplayBlocked = true;
                                    statusEl.innerText = i18n.clickToUnmute;
                                    statusEl.style.backgroundColor = "rgba(239,68,68,0.2)";
                                    statusEl.style.color = "#FCA5A5";
                                    statusEl.style.cursor = "pointer";
                                    statusEl.onclick = () => tryPlayAudio();
                                }
                            });
                        }

                        // Schedule a quick follow-up to fetch cover/lyrics that may not be ready yet
                        nextPollInterval = 800;
                    } finally {
                        isFetchingAudio = false; // Always release, even if something threw
                    }

                // ── Same song playing — keep in sync ─────────────────────────
                } else if (!isFetchingAudio) {
                    // Cover retry: if server didn't have it cached on first poll, retry
                    if (state.coverToken && state.coverToken !== currentCoverToken) {
                        updateCover(state.coverToken);
                    }

                    // Lyrics update (may arrive a cycle late if LRC is large)
                    if (currentLyricsLRC !== state.lyricsLRC) {
                        currentLyricsLRC = state.lyricsLRC;
                        renderLyrics(state.lyricsLRC);
                        syncLyrics(audioPlayer.currentTime);
                    }

                    // Playback sync — throttled by lastActionTime to avoid fighting user clicks
                    if (Date.now() - lastActionTime > 400) {
                        const isNearEnd  = audioPlayer.duration && (audioPlayer.currentTime > audioPlayer.duration - 2);
                        const shouldPlay = state.isPlaying && !audioPlayer.ended && !isNearEnd;

                        if (shouldPlay && audioPlayer.paused && !isAutoplayBlocked && !audioPlayer.error) {
                            audioPlayer.play().catch(err => {
                                if (err.name === 'NotAllowedError') {
                                    isAutoplayBlocked = true;
                                    statusEl.innerText = i18n.clickToUnmute;
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
                            const drift = Math.abs(audioPlayer.currentTime - state.position);
                            if (drift > 3) {
                                audioPlayer.currentTime = state.position;
                            }
                        }
                    }

                    nextPollInterval = state.isPlaying ? 2500 : 2000;
                }

            } catch (error) {
                // Network / timeout error — reset zombie variables and retry
                isFetchingAudio = false;
                console.warn('[LocalCast] Poll error:', error && error.message);
                nextPollInterval = 1500;
            } finally {
                isPolling = false; // Always release re-entrancy guard
                scheduleNextPoll(nextPollInterval);
            }
        }

        audioPlayer.ontimeupdate = () => {
            const current  = audioPlayer.currentTime;
            const duration = audioPlayer.duration || 1;
            progressFill.style.width = ((current / duration) * 100) + '%';
            timeCurrentEl.innerText  = formatTime(current);
            timeTotalEl.innerText    = formatTime(audioPlayer.duration || 0);
            syncLyrics(current);
        };

        audioPlayer.oncanplay = () => {
            if (!isAutoplayBlocked && audioPlayer.paused) {
                audioPlayer.play().catch(() => {});
            }
        };

        audioPlayer.onended = () => {
            fetch('/api/next', { method: 'POST' })
                .catch(() => {})
                .finally(() => {
                    currentSongTitle = ''; // Force next poll to treat next song as new
                    triggerImmediateUpdate();
                });
        };

        audioPlayer.onerror = () => {
            const err = audioPlayer.error;
            console.error("[AudioErrorEvent] Audio player error:", err ? err.code : 'unknown');
            isFetchingAudio  = false; // Unblock zombie on media error
            currentSongTitle = '';    // Force reload on next poll
            statusEl.innerText = i18n.retryingAudio;
            statusEl.style.backgroundColor = "rgba(239,68,68,0.2)";
            statusEl.style.color = "#FCA5A5";
            scheduleNextPoll(1500);
        };

        // Initial launch
        triggerImmediateUpdate();
    </script>
</body>
</html>`;
}
