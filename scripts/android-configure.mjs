// Reapply small, tracked native additions after `tauri android init`.
import { readFileSync, writeFileSync, cpSync } from "node:fs";
const rootGradlePath = "src-tauri/gen/android/build.gradle.kts";
let rootGradle = readFileSync(rootGradlePath, "utf8");
if (!rootGradle.includes('com.chaquo.python:gradle:17.1.0')) {
  rootGradle = rootGradle.replace('classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.10")',
    'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:2.2.10")\n        classpath("com.chaquo.python:gradle:17.1.0")');
  writeFileSync(rootGradlePath, rootGradle);
}
const app = "src-tauri/gen/android/app";
// Keep generated Android launchers in sync with the canonical Lumaire assets.
cpSync("src-tauri/icons/android", `${app}/src/main/res`, { recursive: true });
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
if (!gradle.includes("// Lumaire bundled Android streaming")) {
  gradle += `\n// Lumaire bundled Android streaming\nextra["lumaireStreamingRoot"] = file("../../../android-streaming")\napply(from = file("../../../android-streaming/streaming.gradle"))\n`;
}
if (!gradle.includes('sourceSets["test"].java.srcDir("../../../android/src/test/java")')) {
  gradle += '\nandroid { sourceSets["test"].java.srcDir("../../../android/src/test/java") }\n';
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
if (!manifest.includes("app.lumaire.player.ResolverService")) {
  manifest = manifest.replace("</application>", '    <service android:name="app.lumaire.player.ResolverService" android:exported="false" android:process=":resolver" android:enabled="${lumaireStreamingEnabled}" />\n    </application>');
  writeFileSync(manifestPath, manifest);
}
if (!manifest.includes("app.lumaire.player.NowPlayingWidgetProvider")) {
  manifest = manifest.replace(
    "</application>",
    `        <receiver
            android:name="app.lumaire.player.NowPlayingWidgetProvider"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
                <action android:name="app.lumaire.player.ACTION_WIDGET_PLAY_PAUSE" />
                <action android:name="app.lumaire.player.ACTION_WIDGET_PREV" />
                <action android:name="app.lumaire.player.ACTION_WIDGET_NEXT" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/widget_now_playing_info" />
        </receiver>
        <receiver
            android:name="app.lumaire.player.LyricsWidgetProvider"
            android:exported="true">
            <intent-filter>
                <action android:name="android.appwidget.action.APPWIDGET_UPDATE" />
            </intent-filter>
            <meta-data
                android:name="android.appwidget.provider"
                android:resource="@xml/widget_lyrics_info" />
        </receiver>
    </application>`,
  );
  writeFileSync(manifestPath, manifest);
}
cpSync("src-tauri/android/src/main/res", `${app}/src/main/res`, { recursive: true });

const wrapperPath =
  "src-tauri/gen/android/gradle/wrapper/gradle-wrapper.properties";
const wrapper = readFileSync(wrapperPath, "utf8");
if (!wrapper.includes("networkTimeout="))
  writeFileSync(wrapperPath, `${wrapper}\nnetworkTimeout=120000\n`);
console.log("Configured Android native audio service and document adapters.");
