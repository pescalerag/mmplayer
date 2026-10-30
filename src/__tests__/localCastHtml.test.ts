import { Script } from 'node:vm';
import { getClientHtml, getLocalCastThemeCss, getLocalCastThemeKey, resolveLocalCastTheme, normalizeLocalCastColor } from '../services/LocalCastHtml';
import { readFileSync } from 'node:fs';
import { createLocalCastAudio } from '../services/LocalCastAudio';
import { localCastAudioSource } from '../services/generated/LocalCastAudioSource';

const { generateLocalCastAudioSource, outputPath, generateLocalCastViewSource, viewOutputPath, generateLocalCastReplayGainSource, replayGainOutputPath } = require('../../scripts/generate-localcast-audio.cjs');
// Git checkouts may use CRLF; the generated source must match on Windows and Linux.
const normalizeLineEndings = (source: string) => source.replace(/\r\n/g, '\n');

it('keeps the generated browser source in sync with the original implementation', () => {
  expect(normalizeLineEndings(readFileSync(outputPath, 'utf8'))).toBe(normalizeLineEndings(generateLocalCastAudioSource()));
  expect(normalizeLineEndings(readFileSync(viewOutputPath, 'utf8'))).toBe(normalizeLineEndings(generateLocalCastViewSource()));
  expect(normalizeLineEndings(readFileSync(replayGainOutputPath, 'utf8'))).toBe(normalizeLineEndings(generateLocalCastReplayGainSource()));
});

it('does not serialize native functions when Hermes returns bytecode', () => {
  const nativeToString = jest.spyOn(createLocalCastAudio as { toString: () => string }, 'toString').mockReturnValue('function createLocalCastAudio() { [bytecode] }');
  try {
    const html = getClientHtml({ lang: 'es' });
    expect(nativeToString).not.toHaveBeenCalled();
    expect(html).toContain(localCastAudioSource);
    expect(html).not.toContain('[bytecode]');
  } finally {
    nativeToString.mockRestore();
  }
});

it('embeds valid browser JavaScript with reports, handoff acknowledgement and the tested audio controller', () => {
  const html = getClientHtml({ lang: 'es' });
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  expect(scripts).toHaveLength(1);
  expect(() => new Script(scripts[0][1])).not.toThrow();
  expect(html).toContain('/api/report?stopped=true&report=');
  expect(html).toContain('/api/ended?token=');
  expect(html).toContain('castAudio.sync(state)');
  expect(html.indexOf('castReplayGain.update(state.replayGain)')).toBeLessThan(html.indexOf('castAudio.sync(state)'));
  expect(html).not.toContain('audioPlayer.play().then');
  expect(html).toContain('castAudio.checkConnection()');
  expect(html).toContain('id="localcast-theme"');
  expect(html).toContain("'/api/state?theme='");
  expect(html.indexOf('themeView.sync(state)')).toBeLessThan(html.indexOf('if (state.isStopped)'));
  expect(html).toContain('/api/queue/select?index=');
  expect(html).not.toContain('audioPlayer.oncanplay');
});


it('validates custom colors before inserting them into receiver CSS', () => {
  expect(normalizeLocalCastColor('#abcdef')).toBe('#ABCDEF');
  expect(normalizeLocalCastColor('#fff;}</style><script>alert(1)</script>')).toBe('#8B5CF6');
  const css = getLocalCastThemeCss('custom', '#000000');
  expect(css).toContain('--active-lyric-color: #FFFFFF');
  expect(css).toContain('--badge-color: #FFFFFF');
  expect(css).toContain('--play-btn-hover-border: #000000');
});

it('adapts artwork theme controls to the album while retaining the normal artwork backdrop', () => {
  expect(resolveLocalCastTheme('cover')).toBe('cover');
  expect(getLocalCastThemeKey('cover', '#12abcd')).toBe('cover:#12ABCD');
  const css = getLocalCastThemeCss('cover', '#12ABCD');
  expect(css).toContain('--play-btn-hover-border: #12ABCD');
  expect(css).toContain('--panel-bg: linear-gradient(135deg, rgba(18,171,205,0.40), rgba(18,171,205,0.18))');
  expect(css).toContain('--bg-overlay: radial-gradient(circle at center, rgba(13,15,18,0.4), rgba(13,15,18,0.85))');
  expect(getClientHtml({}, 'cover', '#12ABCD')).toContain('backgroundBlur.style.backgroundImage');
  expect(getLocalCastThemeCss('cover', 'invalid')).not.toContain('invalid');
});

it('places the album theme just before the custom color in the sheet catalog', () => {
  const { LOCALCAST_THEMES } = require('../theme/shareThemes');
  const ids = [...LOCALCAST_THEMES.map((theme: { id: string }) => theme.id), 'custom'];
  expect(ids[0]).toBe('default'); expect(ids.at(-2)).toBe('cover');
});
