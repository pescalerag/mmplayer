const { withAndroidManifest } = require('@expo/config-plugins');

const AUDIO_MIME_TYPES = ['audio/*', 'application/ogg', 'application/x-ogg', 'application/opus'];
const ZIP_MIME_TYPES = ['application/zip', 'application/x-zip-compressed'];
const LOCAL_SCHEMES = new Set(['content', 'file']);

function isLocalFileView(filter) {
  if (!filter.action?.some(action => action.$['android:name'] === 'android.intent.action.VIEW')) return false;
  return filter.data?.some(data => LOCAL_SCHEMES.has(data.$['android:scheme']) || data.$['android:mimeType']);
}

function restrictAudioFileIntents(manifest) {
  const app = manifest.manifest.application[0];
  const components = [...(app.activity || []), ...(app['activity-alias'] || [])];
  for (const component of components) {
    const target = component.$['android:targetActivity'] || component.$['android:name'];
    if (target !== '.MainActivity' && target !== 'MainActivity' && !target.endsWith('.MainActivity')) continue;
    // Replace legacy wildcard filters and duplicate prebuild filters on every icon alias.
    const preserved = (component['intent-filter'] || []).filter(filter => !isLocalFileView(filter));
    component['intent-filter'] = [...preserved, ...[...AUDIO_MIME_TYPES, ...ZIP_MIME_TYPES].map(mimeType => ({
      action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
      category: ['android.intent.category.DEFAULT', 'android.intent.category.BROWSABLE'].map(name => ({ $: { 'android:name': name } })),
      data: [
        { $: { 'android:scheme': 'content' } },
        { $: { 'android:scheme': 'file' } },
        { $: { 'android:mimeType': mimeType } },
      ],
    }))];
  }
  return manifest;
}

module.exports = config => withAndroidManifest(config, mod => {
  mod.modResults = restrictAudioFileIntents(mod.modResults);
  return mod;
});
module.exports.restrictAudioFileIntents = restrictAudioFileIntents;
