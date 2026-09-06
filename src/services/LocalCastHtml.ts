import { LocalCastTheme } from '../store/useSettingsStore';

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

const THEME_CSS: Record<LocalCastTheme, string> = {
    default: `
        :root {
            --bg-overlay: radial-gradient(circle at center, rgba(13, 15, 18, 0.4) 0%, rgba(13, 15, 18, 0.85) 100%);
            --panel-bg: rgba(22, 27, 34, 0.45);
            --panel-border: 1px solid rgba(255, 255, 255, 0.08);
            --panel-shadow: 0 30px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1);
            --play-btn-bg: rgba(139, 92, 246, 0.25);
            --play-btn-border: rgba(139, 92, 246, 0.5);
            --play-btn-shadow: 0 0 14px rgba(139, 92, 246, 0.25);
            --play-btn-hover-bg: rgba(139, 92, 246, 0.45);
            --play-btn-hover-border: #A78BFA;
            --play-btn-hover-shadow: 0 0 20px rgba(139, 92, 246, 0.45);
            --progress-fill-bg: #FFFFFF;
            --progress-fill-shadow: 0 0 10px rgba(255, 255, 255, 0.4), 0 0 20px rgba(139, 92, 246, 0.4);
            --active-lyric-color: #FFFFFF;
            --active-lyric-shadow: 0 0 30px rgba(139, 92, 246, 0.6), 0 0 10px rgba(255, 255, 255, 0.4);
            --badge-bg: rgba(139, 92, 246, 0.15);
            --badge-border: 1px solid rgba(139, 92, 246, 0.3);
            --badge-color: #A78BFA;
            --volume-thumb-hover: #A78BFA;
        }
    `,
    cyberpunk: `
        :root {
            --bg-overlay: radial-gradient(circle at center, rgba(5, 14, 30, 0.55) 0%, rgba(2, 6, 18, 0.97) 100%), linear-gradient(rgba(0, 240, 255, 0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 240, 255, 0.04) 1px, transparent 1px);
            --panel-bg: rgba(6, 16, 36, 0.7);
            --panel-border: 1px solid rgba(0, 240, 255, 0.38);
            --panel-shadow: 0 30px 60px rgba(0, 0, 0, 0.85), 0 0 35px rgba(0, 240, 255, 0.22), inset 0 1px 0 rgba(0, 240, 255, 0.25);
            --play-btn-bg: rgba(0, 240, 255, 0.22);
            --play-btn-border: rgba(0, 240, 255, 0.7);
            --play-btn-shadow: 0 0 20px rgba(0, 240, 255, 0.45);
            --play-btn-hover-bg: rgba(0, 240, 255, 0.45);
            --play-btn-hover-border: #00F0FF;
            --play-btn-hover-shadow: 0 0 30px rgba(0, 240, 255, 0.8);
            --progress-fill-bg: #FFFFFF;
            --progress-fill-shadow: 0 0 10px rgba(255, 255, 255, 0.6), 0 0 18px rgba(0, 240, 255, 0.7);
            --active-lyric-color: #FFFFFF;
            --active-lyric-shadow: 0 0 25px rgba(0, 240, 255, 0.9), 0 0 45px rgba(255, 0, 127, 0.6);
            --badge-bg: rgba(0, 240, 255, 0.18);
            --badge-border: 1px solid rgba(0, 240, 255, 0.5);
            --badge-color: #00F0FF;
            --volume-thumb-hover: #00F0FF;
        }
    `,
    gold: `
        :root {
            --bg-overlay: radial-gradient(circle at center, rgba(24, 17, 6, 0.5) 0%, rgba(7, 5, 1, 0.97) 100%);
            --panel-bg: rgba(28, 20, 7, 0.68);
            --panel-border: 1px solid rgba(251, 191, 36, 0.4);
            --panel-shadow: 0 30px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(245, 158, 11, 0.22), inset 0 1px 0 rgba(253, 230, 138, 0.28);
            --play-btn-bg: rgba(245, 158, 11, 0.28);
            --play-btn-border: rgba(251, 191, 36, 0.7);
            --play-btn-shadow: 0 0 20px rgba(245, 158, 11, 0.4);
            --play-btn-hover-bg: rgba(245, 158, 11, 0.5);
            --play-btn-hover-border: #FBBF24;
            --play-btn-hover-shadow: 0 0 30px rgba(251, 191, 36, 0.7);
            --progress-fill-bg: #FFFFFF;
            --progress-fill-shadow: 0 0 10px rgba(255, 255, 255, 0.5), 0 0 18px rgba(251, 191, 36, 0.6);
            --active-lyric-color: #FFFFFF;
            --active-lyric-shadow: 0 0 25px rgba(245, 158, 11, 0.85), 0 0 40px rgba(251, 191, 36, 0.5);
            --badge-bg: rgba(245, 158, 11, 0.22);
            --badge-border: 1px solid rgba(251, 191, 36, 0.55);
            --badge-color: #FBBF24;
            --volume-thumb-hover: #FBBF24;
        }
    `,
    aurora: `
        :root {
            --bg-overlay: radial-gradient(circle at center, rgba(4, 28, 32, 0.5) 0%, rgba(2, 10, 14, 0.97) 100%);
            --panel-bg: rgba(5, 34, 38, 0.68);
            --panel-border: 1px solid rgba(52, 211, 153, 0.38);
            --panel-shadow: 0 30px 60px rgba(0, 0, 0, 0.8), 0 0 38px rgba(16, 185, 129, 0.22), inset 0 1px 0 rgba(110, 231, 183, 0.28);
            --play-btn-bg: rgba(16, 185, 129, 0.28);
            --play-btn-border: rgba(52, 211, 153, 0.7);
            --play-btn-shadow: 0 0 20px rgba(16, 185, 129, 0.4);
            --play-btn-hover-bg: rgba(16, 185, 129, 0.5);
            --play-btn-hover-border: #34D399;
            --play-btn-hover-shadow: 0 0 30px rgba(16, 185, 129, 0.7);
            --progress-fill-bg: #FFFFFF;
            --progress-fill-shadow: 0 0 10px rgba(255, 255, 255, 0.5), 0 0 18px rgba(16, 185, 129, 0.6);
            --active-lyric-color: #FFFFFF;
            --active-lyric-shadow: 0 0 25px rgba(16, 185, 129, 0.85), 0 0 40px rgba(6, 182, 212, 0.5);
            --badge-bg: rgba(16, 185, 129, 0.22);
            --badge-border: 1px solid rgba(52, 211, 153, 0.55);
            --badge-color: #34D399;
            --volume-thumb-hover: #10B981;
        }
    `,
    emerald: `
        :root {
            --bg-overlay: radial-gradient(circle at center, rgba(3, 25, 16, 0.5) 0%, rgba(1, 9, 6, 0.97) 100%);
            --panel-bg: rgba(3, 30, 20, 0.68);
            --panel-border: 1px solid rgba(16, 185, 129, 0.38);
            --panel-shadow: 0 30px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(16, 185, 129, 0.2), inset 0 1px 0 rgba(110, 231, 183, 0.25);
            --play-btn-bg: rgba(16, 185, 129, 0.25);
            --play-btn-border: rgba(16, 185, 129, 0.7);
            --play-btn-shadow: 0 0 20px rgba(16, 185, 129, 0.45);
            --play-btn-hover-bg: rgba(16, 185, 129, 0.5);
            --play-btn-hover-border: #34D399;
            --play-btn-hover-shadow: 0 0 30px rgba(16, 185, 129, 0.75);
            --progress-fill-bg: #FFFFFF;
            --progress-fill-shadow: 0 0 10px rgba(255, 255, 255, 0.5), 0 0 18px rgba(16, 185, 129, 0.6);
            --active-lyric-color: #FFFFFF;
            --active-lyric-shadow: 0 0 25px rgba(16, 185, 129, 0.9), 0 0 45px rgba(52, 211, 153, 0.5);
            --badge-bg: rgba(16, 185, 129, 0.2);
            --badge-border: 1px solid rgba(16, 185, 129, 0.5);
            --badge-color: #6EE7B7;
            --volume-thumb-hover: #10B981;
        }
    `,
    sunset: `
        :root {
            --bg-overlay: radial-gradient(circle at center, rgba(36, 6, 22, 0.55) 0%, rgba(12, 3, 9, 0.97) 100%);
            --panel-bg: rgba(45, 10, 28, 0.68);
            --panel-border: 1px solid rgba(244, 63, 94, 0.4);
            --panel-shadow: 0 30px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(244, 63, 94, 0.22), inset 0 1px 0 rgba(253, 164, 175, 0.28);
            --play-btn-bg: rgba(244, 63, 94, 0.28);
            --play-btn-border: rgba(244, 63, 94, 0.7);
            --play-btn-shadow: 0 0 20px rgba(244, 63, 94, 0.45);
            --play-btn-hover-bg: rgba(244, 63, 94, 0.5);
            --play-btn-hover-border: #FB7185;
            --play-btn-hover-shadow: 0 0 30px rgba(244, 63, 94, 0.75);
            --progress-fill-bg: #FFFFFF;
            --progress-fill-shadow: 0 0 10px rgba(255, 255, 255, 0.5), 0 0 18px rgba(244, 63, 94, 0.6);
            --active-lyric-color: #FFFFFF;
            --active-lyric-shadow: 0 0 25px rgba(244, 63, 94, 0.85), 0 0 45px rgba(251, 146, 60, 0.55);
            --badge-bg: rgba(244, 63, 94, 0.22);
            --badge-border: 1px solid rgba(244, 63, 94, 0.55);
            --badge-color: #FDA4AF;
            --volume-thumb-hover: #F43F5E;
        }
    `,
    midnight: `
        :root {
            --bg-overlay: radial-gradient(circle at center, rgba(18, 21, 31, 0.6) 0%, rgba(0, 0, 0, 0.98) 100%);
            --panel-bg: rgba(15, 18, 26, 0.75);
            --panel-border: 1px solid rgba(226, 232, 240, 0.25);
            --panel-shadow: 0 30px 60px rgba(0, 0, 0, 0.95), 0 0 35px rgba(255, 255, 255, 0.08), inset 0 1px 0 rgba(255, 255, 255, 0.2);
            --play-btn-bg: rgba(226, 232, 240, 0.18);
            --play-btn-border: rgba(226, 232, 240, 0.6);
            --play-btn-shadow: 0 0 18px rgba(255, 255, 255, 0.25);
            --play-btn-hover-bg: rgba(226, 232, 240, 0.4);
            --play-btn-hover-border: #FFFFFF;
            --play-btn-hover-shadow: 0 0 28px rgba(255, 255, 255, 0.6);
            --progress-fill-bg: #FFFFFF;
            --progress-fill-shadow: 0 0 10px rgba(255, 255, 255, 0.6), 0 0 18px rgba(203, 213, 225, 0.5);
            --active-lyric-color: #FFFFFF;
            --active-lyric-shadow: 0 0 25px rgba(226, 232, 240, 0.8), 0 0 45px rgba(148, 163, 184, 0.45);
            --badge-bg: rgba(226, 232, 240, 0.15);
            --badge-border: 1px solid rgba(226, 232, 240, 0.4);
            --badge-color: #E2E8F0;
            --volume-thumb-hover: #FFFFFF;
        }
    `,
    crimson: `
        :root {
            --bg-overlay: radial-gradient(circle at center, rgba(28, 3, 8, 0.55) 0%, rgba(8, 1, 3, 0.97) 100%);
            --panel-bg: rgba(35, 4, 11, 0.7);
            --panel-border: 1px solid rgba(225, 29, 72, 0.4);
            --panel-shadow: 0 30px 60px rgba(0, 0, 0, 0.85), 0 0 40px rgba(225, 29, 72, 0.25), inset 0 1px 0 rgba(254, 205, 211, 0.25);
            --play-btn-bg: rgba(225, 29, 72, 0.28);
            --play-btn-border: rgba(225, 29, 72, 0.7);
            --play-btn-shadow: 0 0 20px rgba(225, 29, 72, 0.45);
            --play-btn-hover-bg: rgba(225, 29, 72, 0.5);
            --play-btn-hover-border: #FB7185;
            --play-btn-hover-shadow: 0 0 30px rgba(225, 29, 72, 0.75);
            --progress-fill-bg: #FFFFFF;
            --progress-fill-shadow: 0 0 10px rgba(255, 255, 255, 0.5), 0 0 18px rgba(225, 29, 72, 0.6);
            --active-lyric-color: #FFFFFF;
            --active-lyric-shadow: 0 0 25px rgba(225, 29, 72, 0.9), 0 0 45px rgba(244, 63, 94, 0.5);
            --badge-bg: rgba(225, 29, 72, 0.22);
            --badge-border: 1px solid rgba(225, 29, 72, 0.55);
            --badge-color: #FECDD3;
            --volume-thumb-hover: #E11D48;
        }
    `,
};

export function getClientHtml(customTranslations?: Partial<LocalCastTranslations>, theme: LocalCastTheme = 'default'): string {
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

    const themeCss = THEME_CSS[theme] || THEME_CSS.default;

    return `<!DOCTYPE html>
<html lang="${t.lang || 'es'}">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${t.appTitle}</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🎵</text></svg>">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet">
    <style>
        ${themeCss}

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
            background: var(--bg-overlay, radial-gradient(circle at center, rgba(13, 15, 18, 0.4) 0%, rgba(13, 15, 18, 0.85) 100%));
            z-index: 1;
        }

        .main-container {
            display: flex;
            flex-direction: row;
            width: 90vw;
            max-width: 1400px;
            height: 85vh;
            background: var(--panel-bg, rgba(22, 27, 34, 0.45));
            backdrop-filter: blur(24px);
            -webkit-backdrop-filter: blur(24px);
            border: var(--panel-border, 1px solid rgba(255, 255, 255, 0.08));
            border-radius: 32px;
            padding: 48px;
            gap: 56px;
            box-shadow: var(--panel-shadow, 0 30px 60px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1));
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
            background: var(--progress-fill-bg, #FFFFFF);
            border-radius: 6px;
            transition: width 0.2s linear;
            box-shadow: var(--progress-fill-shadow, 0 0 10px rgba(255, 255, 255, 0.4));
        }

        .time-container {
            display: flex;
            justify-content: space-between;
            font-size: 13px;
            font-weight: 600;
            color: #64748B;
        }

        .player-controls {
            display: flex;
            flex-direction: column;
            gap: 12px;
            width: 100%;
            margin-top: 4px;
        }

        .controls-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            width: 100%;
        }

        .playback-buttons {
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .control-btn {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #E2E8F0;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            width: 36px;
            height: 36px;
            border-radius: 50%;
            transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
            outline: none;
        }

        .control-btn:hover {
            color: #FFFFFF;
            background: rgba(255, 255, 255, 0.15);
            border-color: var(--play-btn-hover-border, rgba(167, 139, 250, 0.4));
            transform: scale(1.08);
        }

        .control-btn:active {
            transform: scale(0.94);
        }

        .play-pause-btn {
            width: 40px;
            height: 40px;
            background: var(--play-btn-bg, rgba(139, 92, 246, 0.25));
            border-color: var(--play-btn-border, rgba(139, 92, 246, 0.5));
            color: #FFFFFF;
            box-shadow: var(--play-btn-shadow, 0 0 14px rgba(139, 92, 246, 0.25));
        }

        .play-pause-btn:hover {
            background: var(--play-btn-hover-bg, rgba(139, 92, 246, 0.45));
            border-color: var(--play-btn-hover-border, #A78BFA);
            box-shadow: var(--play-btn-hover-shadow, 0 0 20px rgba(139, 92, 246, 0.45));
            transform: scale(1.1);
        }

        .volume-container {
            flex: 1;
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(255, 255, 255, 0.04);
            padding: 4px 10px;
            border-radius: 12px;
            border: 1px solid rgba(255, 255, 255, 0.06);
            min-width: 130px;
        }

        .volume-btn {
            background: transparent;
            border: none;
            color: #94A3B8;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 4px;
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
            background: var(--volume-thumb-hover, #A78BFA);
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
            background: var(--volume-thumb-hover, #A78BFA);
        }

        .volume-percent {
            font-size: 12px;
            font-weight: 700;
            color: #64748B;
            min-width: 34px;
            text-align: right;
            font-variant-numeric: tabular-nums;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 6px 14px;
            border-radius: 20px;
            background: var(--badge-bg, rgba(139, 92, 246, 0.15));
            border: var(--badge-border, 1px solid rgba(139, 92, 246, 0.3));
            color: var(--badge-color, #A78BFA);
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
            color: var(--active-lyric-color, #FFFFFF);
            font-size: 32px;
            transform: scale(1.05);
            text-shadow: var(--active-lyric-shadow, 0 0 30px rgba(139, 92, 246, 0.6), 0 0 10px rgba(255, 255, 255, 0.4));
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
                <div class="controls-row">
                    <div class="playback-buttons">
                        <button id="prev-btn" class="control-btn" aria-label="Anterior" title="Anterior">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="19 20 9 12 19 4 19 20"></polygon>
                                <line x1="5" y1="19" x2="5" y2="5" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></line>
                            </svg>
                        </button>
                        <button id="play-pause-btn" class="control-btn play-pause-btn" aria-label="Reproducir / Pausar" title="Reproducir / Pausar">
                            <svg id="play-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="6 4 19 12 6 20 6 4"></polygon>
                            </svg>
                            <svg id="pause-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
                                <rect x="6" y="4" width="4" height="16" rx="1"></rect>
                                <rect x="14" y="4" width="4" height="16" rx="1"></rect>
                            </svg>
                        </button>
                        <button id="next-btn" class="control-btn" aria-label="Siguiente" title="Siguiente">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5 4 15 12 5 20 5 4"></polygon>
                                <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"></line>
                            </svg>
                        </button>
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
        const prevBtn          = document.getElementById('prev-btn');
        const playPauseBtn     = document.getElementById('play-pause-btn');
        const playIcon         = document.getElementById('play-icon');
        const pauseIcon        = document.getElementById('pause-icon');
        const nextBtn          = document.getElementById('next-btn');

        function updatePlayPauseUI(isPlaying) {
            if (isPlaying) {
                playIcon.style.display = 'none';
                pauseIcon.style.display = 'block';
            } else {
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
            }
        }

        playPauseBtn.addEventListener('click', () => {
            if (audioPlayer.paused) {
                audioPlayer.play().then(() => {
                    updatePlayPauseUI(true);
                    fetch('/api/play', { method: 'POST' }).catch(() => {});
                }).catch(handleAutoplayBlock);
            } else {
                audioPlayer.pause();
                updatePlayPauseUI(false);
                fetch('/api/pause', { method: 'POST' }).catch(() => {});
            }
        });

        prevBtn.addEventListener('click', () => {
            fetch('/api/previous', { method: 'POST' })
                .catch(() => {})
                .finally(() => {
                    triggerImmediateUpdate();
                });
        });

        nextBtn.addEventListener('click', () => {
            fetch('/api/next', { method: 'POST' })
                .catch(() => {})
                .finally(() => {
                    triggerImmediateUpdate();
                });
        });

        audioPlayer.onplay = () => updatePlayPauseUI(true);
        audioPlayer.onpause = () => updatePlayPauseUI(false);

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

        const progressBarContainer = document.querySelector('.progress-bar-container');
        progressBarContainer.style.cursor = 'pointer';
        progressBarContainer.addEventListener('click', (e) => {
            if (!audioPlayer.duration) return;
            const rect = progressBarContainer.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const pct = Math.max(0, Math.min(1, clickX / rect.width));
            const targetTime = pct * audioPlayer.duration;
            audioPlayer.currentTime = targetTime;
            progressFill.style.width = (pct * 100) + '%';
            timeCurrentEl.innerText = formatTime(targetTime);
            fetch('/api/seek?position=' + targetTime.toFixed(2), { method: 'POST' }).catch(() => {});
        });

        let currentSongTitle       = "";
        let currentLoadedMediaFile = null;
        let lyrics                 = [];
        let currentActiveIndex     = -1;
        let isAutoplayBlocked      = false;
        let lastActionTime         = 0;
        let currentLyricsLRC       = null;
        let currentCoverFileName   = null;
        let lastHandledCmdId       = 0;
        let pollTimeoutId          = null;
        let pendingSeek            = 0;
        let currentSessionId       = null;
        let consecutiveErrors      = 0;

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

        function setStatusActive(text) {
            statusEl.innerText = text;
            statusEl.style.backgroundColor = "var(--badge-bg, rgba(139, 92, 246, 0.15))";
            statusEl.style.border = "var(--badge-border, 1px solid rgba(139, 92, 246, 0.3))";
            statusEl.style.color = "var(--badge-color, #A78BFA)";
            statusEl.style.cursor = "default";
            statusEl.onclick = null;
        }

        function setStatusError(text, isClickable = false, clickHandler = null) {
            statusEl.innerText = text;
            statusEl.style.backgroundColor = "rgba(239, 68, 68, 0.2)";
            statusEl.style.border = "1px solid rgba(239, 68, 68, 0.35)";
            statusEl.style.color = "#FCA5A5";
            statusEl.style.cursor = isClickable ? "pointer" : "default";
            statusEl.onclick = clickHandler;
        }

        // Global Unhandled Rejection Filter (catches benign Chrome extension / Media Router port closures)
        window.addEventListener('unhandledrejection', (event) => {
            const reason = event.reason;
            const msg = reason && (reason.message || String(reason));
            if (typeof msg === 'string' && (
                msg.includes('message channel closed before a response was received') ||
                msg.includes('A listener indicated an asynchronous response') ||
                msg.includes('AbortError') ||
                msg.includes('play() failed')
            )) {
                event.preventDefault();
            }
        });

        function updateMediaSession(title, artist, coverUrl) {
            if ('mediaSession' in navigator) {
                try {
                    navigator.mediaSession.metadata = new MediaMetadata({
                        title: title || i18n.appTitle,
                        artist: artist || i18n.brandName,
                        album: i18n.brandName,
                        artwork: coverUrl ? [{ src: coverUrl, sizes: '512x512', type: 'image/jpeg' }] : []
                    });
                } catch (e) {}
            }
        }

        if ('mediaSession' in navigator) {
            try {
                navigator.mediaSession.setActionHandler('play', () => {
                    audioPlayer.play().then(() => {
                        updatePlayPauseUI(true);
                        fetch('/api/play', { method: 'POST' }).catch(() => {});
                    }).catch(handleAutoplayBlock);
                });
                navigator.mediaSession.setActionHandler('pause', () => {
                    audioPlayer.pause();
                    updatePlayPauseUI(false);
                    fetch('/api/pause', { method: 'POST' }).catch(() => {});
                });
                navigator.mediaSession.setActionHandler('previoustrack', () => {
                    fetch('/api/previous', { method: 'POST' }).catch(() => {}).finally(triggerImmediateUpdate);
                });
                navigator.mediaSession.setActionHandler('nexttrack', () => {
                    fetch('/api/next', { method: 'POST' }).catch(() => {}).finally(triggerImmediateUpdate);
                });
                navigator.mediaSession.setActionHandler('seekto', (details) => {
                    if (details.seekTime !== undefined && audioPlayer.duration) {
                        audioPlayer.currentTime = details.seekTime;
                        fetch('/api/seek?position=' + details.seekTime.toFixed(2), { method: 'POST' }).catch(() => {});
                    }
                });
            } catch (e) {}
        }

        function resetToIdle(statusMessage) {
            audioPlayer.pause();
            audioPlayer.src = '';
            currentSongTitle       = "";
            currentLoadedMediaFile = null;
            currentLyricsLRC       = null;
            currentCoverFileName   = null;
            currentActiveIndex     = -1;
            lastHandledCmdId       = 0;
            
            titleEl.innerText  = i18n.noSong;
            artistEl.innerText = "";
            updateCover(null);
            updatePlayPauseUI(false);
            renderLyrics('');
            progressFill.style.width = '0%';
            timeCurrentEl.innerText  = '0:00';
            timeTotalEl.innerText    = '0:00';
            
            setStatusError(statusMessage || i18n.noSong);
        }

        coverEl.onerror = () => {
            coverEl.src = FALLBACK_COVER;
            backgroundBlur.style.backgroundImage = "none";
        };

        function updateCover(fileName) {
            if (fileName === currentCoverFileName) return;
            currentCoverFileName = fileName;

            if (!fileName) {
                coverEl.src = FALLBACK_COVER;
                backgroundBlur.style.backgroundImage = "none";
                return;
            }

            const coverUrl = '/static/' + fileName;
            coverEl.src = coverUrl;
            backgroundBlur.style.backgroundImage = "url('" + coverUrl + "')";
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

        function handleAutoplayBlock(err) {
            if (err && err.name === 'NotAllowedError') {
                isAutoplayBlocked = true;
                setStatusError(i18n.clickToUnmute, true, () => tryPlayAudio());
            }
        }

        function tryPlayAudio() {
            isAutoplayBlocked = false;
            audioPlayer.play().then(() => {
                setStatusActive(i18n.playing);
            }).catch(handleAutoplayBlock);
        }

        document.body.addEventListener('click', () => {
            if (isAutoplayBlocked) {
                tryPlayAudio();
            }
        });
        let isPolling = false; 

        async function updateState() {
            if (isPolling) return;
            isPolling = true;

            let nextPollInterval = 2000;
            try {
                const controller = new AbortController();
                const timeoutId  = setTimeout(() => controller.abort(), 8000); 

                let response;
                try {
                    let currentPos = '-1';
                    if (currentLoadedMediaFile && audioPlayer.readyState > 0) {
                        currentPos = (audioPlayer.currentTime || 0).toFixed(1);
                    }
                    const isAudioPlaying = !audioPlayer.paused && !audioPlayer.ended && audioPlayer.readyState > 2;
                    const audioDur = (audioPlayer.duration || 0).toFixed(1);
                    response = await fetch('/api/state?pos=' + currentPos + '&playing=' + isAudioPlaying + '&dur=' + audioDur + '&file=' + encodeURIComponent(currentLoadedMediaFile || '') + '&lastCmdId=' + lastHandledCmdId + '&sessionId=' + (currentSessionId || ''), { signal: controller.signal });
                } finally {
                    clearTimeout(timeoutId);
                }

                if (!response.ok) throw new Error('Response not OK: ' + response.status);

                const state = await response.json();

                if (currentSessionId !== null && currentSessionId !== state.sessionId) {
                    currentLoadedMediaFile = null; 
                    currentSessionId = state.sessionId;
                } else if (currentSessionId === null && state.sessionId) {
                    currentSessionId = state.sessionId;
                }

                // ── Explicit Stop from Mobile ──────────────────────────────────
                if (state.isStopped) {
                    resetToIdle(i18n.noSong);
                    nextPollInterval = 2000;
                    return;
                }

                // If no title yet (e.g. queue transition or loading), do NOT wipe player; wait for next poll
                if (!state.title) {
                    scheduleNextPoll(1000);
                    return;
                }

                // ── Remote Commands from Mobile (SEEK, PLAY, PAUSE, STOP) ─────
                if (state.command && state.command.id > lastHandledCmdId) {
                    lastHandledCmdId = state.command.id;
                    if (state.command.type === 'SEEK' && typeof state.command.position === 'number') {
                        audioPlayer.currentTime = state.command.position;
                        if (audioPlayer.duration) {
                            progressFill.style.width = ((state.command.position / audioPlayer.duration) * 100) + '%';
                            timeCurrentEl.innerText  = formatTime(state.command.position);
                        }
                    } else if (state.command.type === 'PLAY') {
                        if (audioPlayer.paused && !isAutoplayBlocked) {
                            audioPlayer.play().catch(handleAutoplayBlock);
                        }
                    } else if (state.command.type === 'PAUSE') {
                        if (!audioPlayer.paused) {
                            audioPlayer.pause();
                        }
                    } else if (state.command.type === 'STOP') {
                        audioPlayer.pause();
                        audioPlayer.src = '';
                        resetToIdle(i18n.noSong);
                    }
                }

                // ── Metadata: Title & Artist ───────────────────────────────────
                if (currentSongTitle !== state.title) {
                    currentSongTitle   = state.title;
                    titleEl.innerText  = state.title;
                    artistEl.innerText = state.artist || '';
                    lastActionTime     = Date.now();
                }

                // ── Cover Image (static HTTP streaming) ────────────────────────
                const resolvedCover = state.coverFileName || state.coverToken || null;
                if (resolvedCover !== currentCoverFileName) {
                    updateCover(resolvedCover);
                }

                // Update Browser Native Media Session
                updateMediaSession(state.title, state.artist, resolvedCover ? '/static/' + resolvedCover : null);

                // ── Lyrics ────────────────────────────────────────────────────
                if (currentLyricsLRC !== state.lyricsLRC) {
                    currentLyricsLRC = state.lyricsLRC;
                    renderLyrics(state.lyricsLRC);
                    syncLyrics(audioPlayer.currentTime);
                }

                // ── Audio Media Loading (Autonomous audio decoding on PC) ─────
                if (state.mediaFileName && currentLoadedMediaFile !== state.mediaFileName) {
                    currentLoadedMediaFile = state.mediaFileName;
                    isAutoplayBlocked = false;
                    const mediaUrl = '/static/' + state.mediaFileName + '?t=' + Date.now();
                    audioPlayer.pause();
                    audioPlayer.src = mediaUrl;
                    audioPlayer.load();

                    if (state.position > 0) {
                        pendingSeek = state.position;
                        const onLoaded = () => {
                            if (pendingSeek > 0) {
                                audioPlayer.currentTime = pendingSeek;
                                pendingSeek = 0;
                            }
                            audioPlayer.removeEventListener('loadedmetadata', onLoaded);
                        };
                        audioPlayer.addEventListener('loadedmetadata', onLoaded);
                        try { audioPlayer.currentTime = state.position; } catch(e){}
                    }

                    if (state.isPlaying) {
                        audioPlayer.play().then(() => {
                            setStatusActive(i18n.streaming);
                        }).catch(handleAutoplayBlock);
                    }
                    nextPollInterval = 1000;
                }

                // ── Sync Play/Pause with Mobile Remote State ──────────────────
                if (currentLoadedMediaFile && !isAutoplayBlocked && !audioPlayer.error) {
                    if (state.isPlaying && audioPlayer.paused) {
                        audioPlayer.play().catch(handleAutoplayBlock);
                    } else if (!state.isPlaying && !audioPlayer.paused) {
                        audioPlayer.pause();
                    }
                }

                if (!isAutoplayBlocked && !audioPlayer.error && state.isPlaying) {
                    setStatusActive(i18n.streaming);
                }

                updatePlayPauseUI(!audioPlayer.paused);

                consecutiveErrors = 0;
                nextPollInterval = 1000;

            } catch (error) {
                console.warn('[LocalCast] Poll error:', error && error.message);
                consecutiveErrors++;
                // Do NOT pause audio player on Wi-Fi jitter! Audio continues playing smoothly from buffer.
                if (consecutiveErrors >= 6) {
                    setStatusError('Reconectando...');
                }
                nextPollInterval = 2000;
            } finally {
                isPolling = false; 
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
                    // Schedule next poll smoothly so the new track is loaded without tearing down
                    scheduleNextPoll(500);
                });
        };

        audioPlayer.onerror = () => {
            const err = audioPlayer.error;
            console.warn("[AudioErrorEvent] Audio player error:", err ? err.code : 'unknown');
            setStatusError(i18n.retryingAudio);
            setTimeout(() => {
                if (currentLoadedMediaFile) {
                    audioPlayer.src = '/static/' + currentLoadedMediaFile + '?retry=' + Date.now();
                    audioPlayer.load();
                    if (!audioPlayer.paused || !isAutoplayBlocked) {
                        audioPlayer.play().catch(handleAutoplayBlock);
                    }
                }
            }, 1000);
            scheduleNextPoll(2000);
        };

        // Initial launch
        triggerImmediateUpdate();
    </script>
</body>
</html>`;
}
