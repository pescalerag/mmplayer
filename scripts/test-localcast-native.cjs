/* global __dirname */
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const root = path.join(__dirname, '..');
const output = path.join(root, 'build/localcast-native-tests');
const server = fs.readFileSync(path.join(root, 'node_modules/react-native-http-bridge-refurbished/android/src/main/java/at/alwinschuster/HttpServer/Server.java'), 'utf8');
const method = / {4}private WritableMap fillRequestMap\([\s\S]*?(?= {4}private void sendEvent)/.exec(server)?.[0];
if (!method) throw new Error('Native request bridge method not found');
const harness = fs.readFileSync(path.join(root, 'tests/native/mmplayer/localcast/tests/LocalCastRequestBridgeTest.java'), 'utf8');
fs.mkdirSync(output, { recursive: true });
const source = path.join(output, 'LocalCastRequestBridgeTest.java');
fs.writeFileSync(source, harness.replace('    // NATIVE_REQUEST_METHOD', method));
const executable = name => process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', name) : name;
execFileSync(executable('javac'), ['-d', output, source], { stdio: 'inherit' });
execFileSync(executable('java'), ['-cp', output, 'mmplayer.localcast.tests.LocalCastRequestBridgeTest'], { stdio: 'inherit' });
