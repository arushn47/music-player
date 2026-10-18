// Reapply small, tracked native additions after `tauri android init`.
import { readFileSync, writeFileSync } from "node:fs";
const app = "src-tauri/gen/android/app";
const gradlePath = `${app}/build.gradle.kts`;
let gradle = readFileSync(gradlePath, "utf8");
// The existing toolchain and test phone support API 36. Do not request preview 37.
gradle = gradle
  .replace(/compileSdk = \d+/, "compileSdk = 36")
  .replace(/targetSdk = \d+/, "targetSdk = 36");
const marker = "// Lumaire native audio and document adapters";
if (!gradle.includes(marker)) {
  gradle += `\n${marker}\nandroid {\n    sourceSets["main"].java.srcDir("../../../android/src/main/java")\n}\ndependencies {\n    implementation("androidx.media3:media3-exoplayer:1.8.0")\n    implementation("androidx.media3:media3-session:1.8.0")\n}\n`;
}
writeFileSync(gradlePath, gradle);
const manifestPath = `${app}/src/main/AndroidManifest.xml`;
let manifest = readFileSync(manifestPath, "utf8");
for (const name of [
  "FOREGROUND_SERVICE",
  "FOREGROUND_SERVICE_MEDIA_PLAYBACK",
  "WAKE_LOCK",
]) {
  if (!manifest.includes(`android.permission.${name}`))
    manifest = manifest.replace(
      "<application",
      `    <uses-permission android:name="android.permission.${name}" />\n    <application`,
    );
}
manifest = manifest.replace(
  /android:allowBackup="true"/,
  'android:allowBackup="false"',
);
if (!manifest.includes("android:allowBackup="))
  manifest = manifest.replace(
    "<application",
    '<application android:allowBackup="false"',
  );
if (!manifest.includes("app.lumaire.player.PlaybackService")) {
  manifest = manifest.replace(
    "</application>",
    `    <service android:name="app.lumaire.player.PlaybackService" android:exported="true" android:foregroundServiceType="mediaPlayback">\n            <intent-filter><action android:name="androidx.media3.session.MediaSessionService" /></intent-filter>\n        </service>\n    </application>`,
  );
}
writeFileSync(manifestPath, manifest);
const wrapperPath =
  "src-tauri/gen/android/gradle/wrapper/gradle-wrapper.properties";
const wrapper = readFileSync(wrapperPath, "utf8");
if (!wrapper.includes("networkTimeout="))
  writeFileSync(wrapperPath, `${wrapper}\nnetworkTimeout=120000\n`);
console.log("Configured Android native audio service and document adapters.");
