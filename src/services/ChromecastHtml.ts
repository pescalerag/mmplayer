export function getChromecastHtml(): string {
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MMPlayer Chromecast</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎵</text></svg>">
    <script src="https://www.gstatic.com/cast/sdk/libs/caf_receiver/v3/cast_receiver_framework.js"></script>
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

        cast-media-player {
            position: absolute;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            opacity: 0.001;
            pointer-events: none;
            z-index: -1;
            --theme-hue: 260;
            --playback-logo-image: none;
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
            white-space: normal;
            text-align: center;
            max-width: 100%;
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
                <div id="title" class="title">Esperando contenido...</div>
                <div id="artist" class="artist">MMPlayer Chromecast</div>
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
            <div style="display: flex; flex-direction: row; align-items: center; gap: 8px; align-self: flex-start;">
                <div class="status-badge" id="sync-status">Conectado</div>
                <div class="beta-badge">Chromecast</div>
            </div>
        </div>

        <div class="right-column">
            <div id="lyrics-scroller" class="lyrics-scroller">
                <div class="lyric-line" style="text-align: center;">No hay letras cargadas</div>
            </div>
        </div>
    </div>

    <!-- Official CAF Media Player element for Google Cast Framework -->
    <cast-media-player></cast-media-player>

    <script>
        var titleEl          = document.getElementById('title');
        var artistEl         = document.getElementById('artist');
        var coverEl          = document.getElementById('cover');
        var statusEl         = document.getElementById('sync-status');
        var backgroundBlur   = document.getElementById('background-blur');
        var lyricsScroller   = document.getElementById('lyrics-scroller');
        var progressFill     = document.getElementById('progress-fill');
        var timeCurrentEl    = document.getElementById('time-current');
        var timeTotalEl      = document.getElementById('time-total');

        var FALLBACK_COVER = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='320' height='320' viewBox='0 0 24 24' fill='none' stroke='%23333' stroke-width='2'><rect width='20' height='20' x='2' y='2' rx='2'/><circle cx='12' cy='12' r='4'/></svg>";

        var lyrics             = [];
        var currentActiveIndex = -1;

        // Watchdog: if no LOAD arrives within 30s of startup, show a helpful hint
        var watchdogTimer = setTimeout(function() {
            if (titleEl.innerText === 'Esperando contenido...') {
                setStatus('Abre MMPlayer y reproduce una canción', false);
            }
        }, 30000);

        function setStatus(text, isError) {
            statusEl.innerText = text;
            if (isError) {
                statusEl.style.backgroundColor = "rgba(239,68,68,0.15)";
                statusEl.style.color = "#FCA5A5";
                statusEl.style.borderColor = "rgba(239,68,68,0.3)";
            } else {
                statusEl.style.backgroundColor = "rgba(139,92,246,0.15)";
                statusEl.style.color = "#A78BFA";
                statusEl.style.borderColor = "rgba(139,92,246,0.3)";
            }
        }

        coverEl.onerror = function() {
            coverEl.src = FALLBACK_COVER;
            backgroundBlur.style.backgroundImage = "none";
        };

        function updateCover(url) {
            if (url) {
                coverEl.src = url;
                backgroundBlur.style.backgroundImage = "url('" + url + "')";
            } else {
                coverEl.src = FALLBACK_COVER;
                backgroundBlur.style.backgroundImage = "none";
            }
        }

        function parseLRC(lrcText) {
            if (!lrcText) return [];
            var result = [];
            var lines = lrcText.split(/\\r?\\n/);
            var timeTagRegex = /\\[(\\d{1,3}):(\\d{2})(?:[.:](\\d{1,3}))?\\]/g;

            for (var li = 0; li < lines.length; li++) {
                var line = lines[li];
                if (!line.trim()) continue;
                var times = [];
                var match;
                timeTagRegex.lastIndex = 0;

                while ((match = timeTagRegex.exec(line)) !== null) {
                    var min = parseInt(match[1], 10);
                    var sec = parseInt(match[2], 10);
                    var ms = 0;
                    if (match[3]) {
                        var msStr = match[3].trim().padEnd(3, '0').substring(0, 3);
                        ms = parseInt(msStr, 10);
                    }
                    times.push(min * 60 + sec + ms / 1000);
                }

                var text = line.replace(timeTagRegex, '').trim();
                if (text && times.length > 0) {
                    for (var ti = 0; ti < times.length; ti++) {
                        result.push({ time: times[ti], text: text });
                    }
                }
            }
            return result.sort(function(a, b) { return a.time - b.time; });
        }

        function formatTime(seconds) {
            if (isNaN(seconds) || seconds === null) return '0:00';
            var mins = Math.floor(seconds / 60);
            var secs = Math.floor(seconds % 60);
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
            lyrics.forEach(function(item, index) {
                var div = document.createElement('div');
                div.className = 'lyric-line';
                div.id = 'lyric-' + index;
                div.innerText = item.text;
                lyricsScroller.appendChild(div);
            });
        }

        function syncLyrics(currentTime) {
            if (!lyrics || lyrics.length === 0) return;
            var activeIndex = -1;
            for (var i = 0; i < lyrics.length; i++) {
                if (currentTime >= lyrics[i].time) {
                    activeIndex = i;
                } else {
                    break;
                }
            }

            if (activeIndex === currentActiveIndex) return;
            currentActiveIndex = activeIndex;

            var lines = lyricsScroller.children;
            for (var i = 0; i < lines.length; i++) {
                if (i === activeIndex) {
                    lines[i].classList.add('active');
                    var containerHeight = lyricsScroller.parentElement.clientHeight;
                    var lineOffsetTop   = lines[i].offsetTop;
                    var lineHeight      = lines[i].clientHeight;
                    var targetY         = -(lineOffsetTop - (containerHeight / 2) + (lineHeight / 2));
                    lyricsScroller.style.transform = 'translateY(' + targetY + 'px)';
                } else {
                    lines[i].classList.remove('active');
                }
            }
        }

        // Initialize Google Cast CAF Receiver
        if (typeof cast !== 'undefined' && cast.framework) {
            try {
                var castContext = cast.framework.CastReceiverContext.getInstance();
                var CAST_NAMESPACE = 'urn:x-cast:com.pescalerag.mmplayer';

                // 1. Canal personalizado (Datos Fuera de Banda): Recibe letras y carátula sin saturar el LOAD
                castContext.addCustomMessageListener(CAST_NAMESPACE, function(customEvent) {
                    console.log('[CAF Receiver] Custom message received:', customEvent.data);
                    try {
                        var data = typeof customEvent.data === 'string' ? JSON.parse(customEvent.data) : customEvent.data;
                        if (!data) return;

                        if (data.action === 'UPDATE_LYRICS' || data.lyricsLRC !== undefined) {
                            renderLyrics(data.lyricsLRC || '');
                        }
                        if (data.coverUrl) {
                            updateCover(data.coverUrl);
                        }
                    } catch (e) {
                        console.error('[CAF Receiver] Error parsing custom message:', e);
                    }
                });

                var playerManager = castContext.getPlayerManager();

                // 2. Interceptor de Carga Oficial (Carga Ligera): Extrae metadatos y apaga el watchdog
                playerManager.setMessageInterceptor(
                    cast.framework.messages.MessageType.LOAD,
                    function(loadRequestData) {
                        clearTimeout(watchdogTimer);
                        console.log('[CAF Receiver] Official LOAD intercepted');

                        if (loadRequestData && loadRequestData.media) {
                            var meta = loadRequestData.media.metadata;
                            if (meta) {
                                if (meta.title) titleEl.innerText = meta.title;
                                if (meta.artist) artistEl.innerText = meta.artist;
                                if (meta.images && meta.images[0] && meta.images[0].url) {
                                    updateCover(meta.images[0].url);
                                }
                            }
                        }
                        setStatus("Cargando...", false);
                        return loadRequestData;
                    }
                );

                // 3. Sincronización de progreso y letras mediante eventos del PlayerManager
                playerManager.addEventListener(
                    cast.framework.events.EventType.TIME_UPDATE,
                    function(event) {
                        var current = event.currentMediaTime;
                        var duration = playerManager.getDurationSec() || 1;
                        progressFill.style.width = ((current / duration) * 100) + '%';
                        timeCurrentEl.innerText  = formatTime(current);
                        timeTotalEl.innerText    = formatTime(duration);
                        syncLyrics(current);
                    }
                );

                // 4. Estados del reproductor nativo
                playerManager.addEventListener(
                    cast.framework.events.EventType.PLAYER_STATE_CHANGED,
                    function(event) {
                        var state = event.playerState;
                        console.log('[CAF Receiver] Player state:', state);
                        if (state === cast.framework.messages.PlayerState.PLAYING) {
                            setStatus("Transmitiendo", false);
                        } else if (state === cast.framework.messages.PlayerState.PAUSED) {
                            setStatus("En pausa", false);
                        } else if (state === cast.framework.messages.PlayerState.BUFFERING) {
                            setStatus("Cargando...", false);
                        } else if (state === cast.framework.messages.PlayerState.IDLE) {
                            if (event.idleReason === cast.framework.messages.IdleReason.FINISHED) {
                                setStatus("Finalizado", false);
                            } else if (event.idleReason === cast.framework.messages.IdleReason.ERROR) {
                                setStatus("Error de reproducción", true);
                            }
                        }
                    }
                );

                // 5. Listener de errores multimedia
                playerManager.addEventListener(
                    cast.framework.events.EventType.ERROR,
                    function(event) {
                        var errCode = event && event.detailedErrorCode ? event.detailedErrorCode : (event && event.reason ? event.reason : 'unknown');
                        console.error('[CAF Receiver] Media Error:', errCode, event);
                        setStatus("Error (" + errCode + ")", true);
                    }
                );

                var castOptions = {
                    disableIdleTimeout: true,
                    maxInactivity: 3600,
                    statusText: 'MMPlayer'
                };

                castContext.start(castOptions);
                console.log('[CAF Receiver] CastReceiverContext started successfully');
            } catch (err) {
                console.error('[CAF Receiver] CAF initialization error:', err);
                setStatus('Error de inicialización: ' + (err ? err.message : ''), true);
            }
        } else {
            console.error('[CAF Receiver] cast.framework not available - SDK failed to load');
            setStatus('SDK no disponible', true);
        }

        // Global Error Handler for TV On-Screen Diagnostics
        window.onerror = function(msg, url, line, col, error) {
            console.error('Window Error:', msg, line, col);
            var errEl = document.getElementById('debug-banner');
            if (!errEl) {
                errEl = document.createElement('div');
                errEl.id = 'debug-banner';
                errEl.style.cssText = 'position:fixed;top:10px;left:10px;right:10px;background:rgba(220,38,38,0.9);color:#fff;padding:12px 18px;font-size:16px;border-radius:12px;z-index:999999;font-family:sans-serif;font-weight:bold;';
                document.body.appendChild(errEl);
            }
            errEl.innerText = 'JS ERR: ' + msg + ' (L' + line + ':' + col + ')';
        };
    </script>
</body>
</html>`;
}
