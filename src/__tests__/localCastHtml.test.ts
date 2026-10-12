import { Script } from 'node:vm';
import { getClientHtml } from '../services/LocalCastHtml';
import { readFileSync } from 'node:fs';
import { createLocalCastAudio } from '../services/LocalCastAudio';
import { localCastAudioSource } from '../services/generated/LocalCastAudioSource';

const { generateLocalCastAudioSource, outputPath, generateLocalCastViewSource, viewOutputPath, generateLocalCastReplayGainSource, replayGainOutputPath } = require('../../scripts/generate-localcast-audio.cjs');

it('keeps the generated browser source in sync with the original implementation', () => {
  expect(readFileSync(outputPath, 'utf8')).toBe(generateLocalCastAudioSource());
  expect(readFileSync(viewOutputPath, 'utf8')).toBe(generateLocalCastViewSource());
  expect(readFileSync(replayGainOutputPath, 'utf8')).toBe(generateLocalCastReplayGainSource());
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
  expect(html).toContain('/api/queue/select?index=');
  expect(html).not.toContain('audioPlayer.oncanplay');
});
