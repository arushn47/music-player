// Android tooling is scoped to this process. Never load user API keys from .env.
import { existsSync, readdirSync, copyFileSync, mkdirSync, statSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const root = process.cwd();
const env = { ...process.env };
const first = (...paths) => paths.find((value) => value && existsSync(value));
env.JAVA_HOME = first(
  env.JAVA_HOME,
  "C:/Program Files/Android/Android Studio/jbr",
);
env.ANDROID_HOME = first(
  env.ANDROID_HOME,
  env.ANDROID_SDK_ROOT,
  path.join(env.LOCALAPPDATA || "", "Android/Sdk"),
);
const ndks = env.ANDROID_HOME && path.join(env.ANDROID_HOME, "ndk");
env.NDK_HOME = first(
  env.NDK_HOME,
  env.ANDROID_NDK_HOME,
  path.resolve(".tools/android/android-ndk-r27c"),
  ...(ndks && existsSync(ndks)
    ? readdirSync(ndks)
        .sort()
        .reverse()
        .map((name) => path.join(ndks, name))
    : []),
);
env.CARGO_HOME = path.resolve(".tools/cargo");
env.RUSTUP_HOME = first(
  env.RUSTUP_HOME,
  path.resolve(".tools/rustup"),
  "D:/Rust/rustup",
);
env.RUSTUP_TOOLCHAIN ||= "stable";
const cargoBin = first(
  "D:/Rust/cargo/bin",
  path.join(env.USERPROFILE || "", ".cargo/bin"),
);
const inherited = env.PATH || env.Path || "";
for (const key of Object.keys(env))
  if (key.toLowerCase() === "path") delete env[key];
env.PATH = [
  cargoBin,
  env.JAVA_HOME && path.join(env.JAVA_HOME, "bin"),
  inherited,
]
  .filter(Boolean)
  .join(path.delimiter);
// Keep Gradle caches reproducible and out of the user's global configuration.
env.GRADLE_USER_HOME ||= path.resolve(".tools/android/gradle");

const [command = "doctor", ...args] = process.argv.slice(2);
const required = ["JAVA_HOME", "ANDROID_HOME", "NDK_HOME"];
if (command === "doctor") {
  for (const key of required) console.log(`${key}: ${env[key] || "MISSING"}`);
  if (env.ANDROID_HOME)
    spawnSync(
      path.join(env.ANDROID_HOME, "platform-tools/adb.exe"),
      ["devices", "-l"],
      { env, stdio: "inherit", windowsHide: true },
    );
  process.exit(required.every((key) => env[key]) ? 0 : 1);
}
const missing = required.filter((key) => !env[key]);
if (missing.length) {
  console.error(
    `Missing Android build tools: ${missing.join(", ")}. See README.md for Android setup.`,
  );
  process.exit(1);
}
if (command === "install") {
  const adb = path.join(env.ANDROID_HOME, "platform-tools/adb.exe");
  const candidates = [
    path.resolve("releases/Lumaire-v1.0.5/Lumaire-1.0.5-Android-arm64.apk"),
    path.resolve("src-tauri/gen/android/app/build/outputs/apk/arm64/debug/app-arm64-debug.apk"),
  ].filter(existsSync);
  candidates.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  const targetApk = candidates[0];
  if (!targetApk) {
    console.error("No APK found to install.");
    process.exit(1);
  }
  console.log(`Installing newest APK: ${path.basename(targetApk)} (modified ${new Date(statSync(targetApk).mtimeMs).toLocaleTimeString()}) via ADB...`);
  let result = spawnSync(adb, ["install", "-r", targetApk], { env, stdio: "inherit" });
  if (result.status !== 0) {
    console.log("Install failed; attempting with -d flag...");
    result = spawnSync(adb, ["install", "-r", "-d", targetApk], { env, stdio: "inherit" });
  }
  process.exit(result.status ?? 0);
}
if (!["init", "build", "dev", "install"].includes(command))
  throw new Error("Use doctor, init, build, dev or install.");
const cli = path.resolve("node_modules/@tauri-apps/cli/tauri.js");
const options = command === "init" ? ["--ci", "--skip-targets-install"] : [];
let failure = "";
const status = await new Promise((resolve, reject) => {
  const child = spawn(
    process.execPath,
    [cli, "android", command, ...options, ...args],
    { cwd: root, env, stdio: ["inherit", "pipe", "pipe"], windowsHide: true },
  );
  child.stdout.on("data", (bytes) => process.stdout.write(bytes));
  child.stderr.on("data", (bytes) => {
    process.stderr.write(bytes);
    failure = (failure + bytes.toString()).slice(-16000);
  });
  child.on("error", reject);
  child.on("close", resolve);
});
if (status === 0 && command === "init") {
  const configured = spawnSync(
    process.execPath,
    ["scripts/android-configure.mjs"],
    { cwd: root, env, stdio: "inherit" },
  );
  process.exit(configured.status ?? 1);
}
if (
  status !== 0 &&
  command === "build" &&
  process.platform === "win32" &&
  failure.includes("Creation symbolic link is not allowed")
) {
  // The Rust build succeeded; only the CLI's symlink step failed. Copy the exact
  // freshly compiled ARM64 library, then skip its duplicate Gradle task.
  // Never use this fallback after a compiler failure or for another target.
  if (
    (!args.includes("--debug") && !args.includes("--apk")) ||
    args[args.indexOf("--target") + 1] !== "aarch64"
  )
    process.exit(status ?? 1);
  const profile = args.includes("--debug") ? "debug" : "release";
  const flavor = profile === "debug" ? "Debug" : "Release";
  const source = path.resolve(
    `src-tauri/target/aarch64-linux-android/${profile}/liblumaire_lib.so`,
  );
  const destination = path.resolve(
    "src-tauri/gen/android/app/src/main/jniLibs/arm64-v8a/liblumaire_lib.so",
  );
  mkdirSync(path.dirname(destination), { recursive: true });
  copyFileSync(source, destination);
  console.log(
    "Native compilation succeeded. Packaging with a copied library because Windows symlinks are unavailable.",
  );
  const built = spawnSync(
    path.join(env.JAVA_HOME, "bin/java.exe"),
    [
      "-Djava.net.preferIPv4Stack=true",
      "-classpath",
      "gradle/wrapper/gradle-wrapper.jar",
      "org.gradle.wrapper.GradleWrapperMain",
      `:app:assembleArm64${flavor}`,
      "-x",
      `:app:rustBuildArm64${flavor}`,
      "--console=plain",
      "-Dorg.gradle.internal.http.socketTimeout=60000",
      "-Dorg.gradle.internal.http.connectionTimeout=30000",
    ],
    {
      cwd: path.resolve("src-tauri/gen/android"),
      env,
      stdio: "inherit",
      windowsHide: true,
    },
  );
  process.exit(built.status ?? 1);
}
process.exit(status ?? 1);
