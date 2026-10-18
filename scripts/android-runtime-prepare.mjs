// Fetch immutable public source/wheels, verify hashes, cross-compile QuickJS.
// Dependencies are bundled at build time; nothing is downloaded at app startup.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
const root = path.resolve(import.meta.dirname, '..');
const cache = path.join(root, '.tools/android-streaming');
mkdirSync(cache, { recursive: true });
const artifacts = [
  ['yt_dlp-2026.8.19-py3-none-any.whl', 'https://files.pythonhosted.org/packages/69/b2/8cd1613f56eed7ceb64fbd4df3f1c01246bfb098e6f398228bafda22b80b/yt_dlp-2026.8.19-py3-none-any.whl', '1d57897e94c6665a0a6f9bc54b34e584284e32c034ffab3a7df25d8f7b24eedf'],
  ['yt_dlp_ejs-0.8.0-py3-none-any.whl', 'https://files.pythonhosted.org/packages/e3/bd/520769863744b669440a924271a6159ddd82ad5ae26b4ac4d4b69e9f8d44/yt_dlp_ejs-0.8.0-py3-none-any.whl', '79300e5fca7f937a1eeede11f0456862c1b41107ce1d726871e0207424f4bdb4'],
  ['quickjs-v0.17.0.zip', 'https://github.com/quickjs-ng/quickjs/archive/refs/tags/v0.17.0.zip', '9de1bf573606d2aebbbab6217e616a66e09e3613518489b37b9b3157cf398dcc'],
];
for (const [name, url, sha256] of artifacts) {
  const file = path.join(cache, name);
  if (!existsSync(file)) {
    const response = await fetch(url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok) throw Error(`${name}: HTTP ${response.status}`);
    writeFileSync(file, Buffer.from(await response.arrayBuffer()));
  }
  if (createHash('sha256').update(readFileSync(file)).digest('hex') !== sha256) throw Error(`SHA-256 mismatch: ${name}`);
  console.log(`Verified ${name}`);
}
function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit', windowsHide: true });
  if (result.status !== 0) throw Error(`${command} failed: ${result.status}`);
}
if (!existsSync(path.join(cache, 'quickjs-0.17.0/CMakeLists.txt'))) {
  run('powershell.exe', ['-NoProfile', '-Command', "Expand-Archive -LiteralPath '.tools/android-streaming/quickjs-v0.17.0.zip' -DestinationPath '.tools/android-streaming'"]);
}
const ndk = process.env.NDK_HOME || path.join(root, '.tools/android/android-ndk-r27c');
run('cmake', ['-S', path.join(cache, 'quickjs-0.17.0'), '-B', path.join(cache, 'qjs-build'), '-G', 'Ninja',
  `-DCMAKE_MAKE_PROGRAM=${process.env.LUMAIRE_NINJA || 'C:/mingw64/bin/ninja.exe'}`,
  `-DCMAKE_TOOLCHAIN_FILE=${path.join(ndk, 'build/cmake/android.toolchain.cmake').replaceAll('\\', '/')}`,
  '-DANDROID_ABI=arm64-v8a', '-DANDROID_PLATFORM=android-26', '-DANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES=ON',
  '-DCMAKE_BUILD_TYPE=Release', '-DQJS_ENABLE_INSTALL=OFF']);
run('cmake', ['--build', path.join(cache, 'qjs-build'), '--target', 'qjs', '-j', '4']);
run(path.join(ndk, 'toolchains/llvm/prebuilt/windows-x86_64/bin/llvm-strip.exe'), ['--strip-all', path.join(cache, 'qjs-build/qjs')]);
