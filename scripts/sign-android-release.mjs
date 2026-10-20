// Release signing material stays in ignored .tools, never in the share folder.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import assert from 'node:assert/strict';

const [input, output] = process.argv.slice(2).map(value => path.resolve(value));
assert(input && output && input !== output, 'Supply unsigned APK and a different signed output path.');
assert(existsSync(input), 'Unsigned APK does not exist.');
assert(!existsSync(output), 'Refusing to overwrite an existing signed release.');
const sdk = process.env.ANDROID_HOME || 'C:/Users/ARUSH/AppData/Local/Android/Sdk';
const javaHome = process.env.JAVA_HOME || 'C:/Program Files/Android/Android Studio/jbr';
const tools = path.join(sdk, 'build-tools/36.0.0');
const privateDir = path.resolve('.tools/release-signing');
const key = path.join(privateDir, 'lumaire-release.p12');
const passwordFile = path.join(privateDir, 'password.txt');
const aligned = path.join(privateDir, 'aligned-release.apk');
const run = (command, args, env = process.env) => {
  const result = spawnSync(command, args, { env, stdio: 'inherit', windowsHide: true });
  assert.equal(result.status, 0, `${path.basename(command)} failed`);
};
const expected = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'));
const manifest = spawnSync(path.join(tools, 'aapt.exe'), ['dump', 'badging', input],
  { encoding: 'utf8', windowsHide: true });
assert.equal(manifest.status, 0, 'Could not read APK metadata.');
const identity = manifest.stdout.match(/^package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'/m);
assert(identity && identity[1] === expected.identifier && identity[3] === expected.version,
  'APK identity/version does not match tauri.conf.json; finish the current Android build before signing.');
mkdirSync(privateDir, { recursive: true });
// Restrict both the key and its password to this Windows user and SYSTEM.
const owner = spawnSync('whoami.exe', [], { encoding: 'utf8', windowsHide: true });
assert.equal(owner.status, 0);
run('icacls.exe', [privateDir, '/inheritance:r', '/grant:r', `${owner.stdout.trim()}:(OI)(CI)F`, '*S-1-5-18:(OI)(CI)F']);
assert(!existsSync(key) || existsSync(passwordFile), 'Existing key has no password file; recover it instead of replacing the key.');
if (!existsSync(passwordFile)) writeFileSync(passwordFile, randomBytes(32).toString('hex'), { flag: 'wx' });
const env = { ...process.env, LUMAIRE_RELEASE_STORE_PASSWORD: readFileSync(passwordFile, 'utf8').trim() };
if (!existsSync(key)) {
  run(path.join(javaHome, 'bin/keytool.exe'), [
    '-genkeypair', '-noprompt', '-keystore', key, '-storetype', 'PKCS12',
    '-storepass:env', 'LUMAIRE_RELEASE_STORE_PASSWORD', '-alias', 'lumaire',
    '-keyalg', 'RSA', '-keysize', '3072', '-validity', '10000',
    '-dname', 'CN=Lumaire Friend Testing, O=Lumaire',
  ], env);
}
mkdirSync(path.dirname(output), { recursive: true });
run(path.join(tools, 'zipalign.exe'), ['-f', '-P', '16', '4', input, aligned]);
const java = path.join(javaHome, 'bin/java.exe');
const signer = ['-jar', path.join(tools, 'lib/apksigner.jar')];
run(java, [...signer, 'sign', '--ks', key, '--ks-key-alias', 'lumaire',
  '--ks-pass', 'env:LUMAIRE_RELEASE_STORE_PASSWORD', '--out', output, aligned], env);
run(java, [...signer, 'verify', '--verbose', '--print-certs', output]);
run(path.join(tools, 'zipalign.exe'), ['-c', '-P', '16', '4', output]);
console.log('Verified signed release APK. Back up .tools/release-signing privately; never share it.');
