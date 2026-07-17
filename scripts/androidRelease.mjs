// Build + install a local RELEASE APK straight onto a connected device via Gradle's
// `installRelease` task. Adapted from spatchr's android:release, minus its production-keystore
// preflight — dartscape's release build is debug-signed (android/app/build.gradle uses
// signingConfigs.debug for the release config), so there's no signing to verify.
//
// This is deliberately NOT `expo run:android --variant release`: that spins up a Metro dev
// server and uses Expo's device picker. A release build embeds its JS bundle (the react gradle
// plugin runs `createBundleReleaseJsAndAssets`), so no Metro server is wanted — this just builds
// the release and pushes it to the phone. Use it to judge real performance (framerate), which a
// debug build never reflects.
import { execSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const androidDir = join(process.cwd(), "android");
if (!existsSync(androidDir)) {
  throw new Error(
    "No android/ project found. Run `npm run apk` (or `expo prebuild --platform android`) first.",
  );
}

// Metro's cache reset does a recursive rmdir that throws ENOTEMPTY on Windows whenever a stale
// handle lingers (antivirus/indexer) — a very common local release-build failure. Pre-clear the
// cache with retries so the release bundler starts clean and never hits Metro's fragile clear().
const metroCache = join(tmpdir(), "metro-cache");
try {
  rmSync(metroCache, { recursive: true, force: true, maxRetries: 10, retryDelay: 250 });
  console.info(`[android:release] Cleared Metro cache (${metroCache}).`);
} catch (error) {
  console.warn(
    `[android:release] Could not fully clear Metro cache (${metroCache}); continuing.`,
    error,
  );
}

const gradle =
  process.platform === "win32" ? "gradlew.bat installRelease" : "./gradlew installRelease";

// execSync runs through the system shell (cmd.exe on Windows, /bin/sh on POSIX), so `gradlew.bat`
// resolves without an explicit `shell` option.
console.info(`\n> ${gradle}  (in ${androidDir})`);
execSync(gradle, { cwd: androidDir, stdio: "inherit", env: process.env });

console.info("\n[android:release] Installed a RELEASE build on the connected device.");
