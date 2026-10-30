const path = require('node:path');
const version = require('./package.json').version;
const unsigned = process.env.MMPLAYER_UNSIGNED_PREVIEW === '1';
const unsignedBeta = process.env.MMPLAYER_UNSIGNED_BETA === '1';
if (!/^\d+\.\d+\.\d+-beta\.\d+$/.test(version)) throw Error('Expected a beta version');
if (!unsigned && !unsignedBeta && !process.env.CSC_LINK && !process.env.WIN_CSC_LINK && !process.env.MMPLAYER_CERT_SHA1) {
  throw Error('A public signing certificate is required. Use desktop:installer:preview only for local testing.');
}
module.exports = {
  appId: 'com.pescalerag.mmplayer.desktop',
  productName: 'MMPlayer',
  copyright: 'Copyright © 2026 Pepe Escalera',
  electronVersion: require('./package.json').devDependencies.electron,
  electronDist: path.dirname(require.resolve('electron/dist/electron.exe')),
  directories: { app: 'build/package', output: 'release', buildResources: 'build/installer-assets' },
  files: ['**/*', '!**/*.map', '!**/*.ts', '!**/*.md', '!**/test{,s}/**'],
  extraFiles: [{ from: '../../LICENSE', to: 'LICENSE.txt' }, { from: 'build/notices', to: 'licenses' }],
  asar: true,
  asarUnpack: ['libraryWorker.cjs', 'metadataWorker.cjs', 'node_modules/**/*'],
  npmRebuild: false,
  nodeGypRebuild: false,
  buildDependenciesFromSource: false,
  forceCodeSigning: !unsigned && !unsignedBeta,
  artifactName: `MMPlayer-${version}-windows-\${arch}${unsigned ? '-UNSIGNED-PREVIEW' : unsignedBeta ? '-UNSIGNED' : ''}.\${ext}`,
  electronFuses: {
    runAsNode: false,
    enableNodeOptionsEnvironmentVariable: false,
    enableNodeCliInspectArguments: false,
    enableEmbeddedAsarIntegrityValidation: true,
    onlyLoadAppFromAsar: true,
    grantFileProtocolExtraPrivileges: false,
  },
  win: {
    target: [{ target: 'nsis', arch: ['x64'] }],
    icon: 'build/installer-assets/icon.ico',
    executableName: 'MMPlayer',
    requestedExecutionLevel: 'asInvoker',
    signAndEditExecutable: true,
    ...(process.env.MMPLAYER_CERT_SHA1 ? { signtoolOptions: { certificateSha1: process.env.MMPLAYER_CERT_SHA1, signingHashAlgorithms: ['sha256'] } } : {}),
  },
  nsis: {
    include: 'installer/custom.nsh',
    guid: 'ad67e208-0f85-4d1b-af28-406fb811b975',
    oneClick: false,
    perMachine: false,
    selectPerMachineByDefault: false,
    allowElevation: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
    shortcutName: 'MMPlayer',
    uninstallDisplayName: `MMPlayer ${version}`,
    deleteAppDataOnUninstall: false,
    runAfterFinish: true,
    displayLanguageSelector: false,
    installerLanguages: ['en_US', 'es_ES', 'pt_PT'],
    multiLanguageInstaller: true,
    license: '../../LICENSE',
    installerIcon: 'build/installer-assets/icon.ico',
    uninstallerIcon: 'build/installer-assets/icon.ico',
    installerHeader: 'build/installer-assets/header.bmp',
    installerSidebar: 'build/installer-assets/sidebar.bmp',
    uninstallerSidebar: 'build/installer-assets/sidebar.bmp',
  },
  // Publishing is a separate command after tests and signature verification.
  publish: null,
};
