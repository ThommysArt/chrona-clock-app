#!/usr/bin/env node
/**
 * Build a variant-specific Android APK and copy it to a versioned filename:
 *   dist/chrona-1.0.0-dev.apk
 *   dist/chrona-1.0.0-preview.apk
 *
 * Usage:
 *   APP_VARIANT=development node scripts/build-apk.mjs debug
 *   APP_VARIANT=preview     node scripts/build-apk.mjs release
 *   node scripts/build-apk.mjs release --skip-prebuild
 */
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const androidRoot = join(root, "android");
const distDir = join(root, "dist");

const buildType = (process.argv[2] || "release").toLowerCase(); // debug | release
const skipPrebuild = process.argv.includes("--skip-prebuild");

function resolveVariant() {
  const raw = (process.env.APP_VARIANT || "").toLowerCase().trim();
  if (raw === "development" || raw === "dev") return "development";
  if (raw === "preview" || raw === "pre") return "preview";
  if (raw === "production" || raw === "prod") return "production";
  // Infer from build type when unset
  return buildType === "debug" ? "development" : "preview";
}

function readVersion() {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  return pkg.version || "0.0.0";
}

function variantSlug(variant) {
  if (variant === "development") return "dev";
  if (variant === "preview") return "preview";
  return "prod";
}

function run(cmd, args, opts = {}) {
  console.log(`$ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, {
    cwd: opts.cwd || root,
    env: { ...process.env, ...opts.env },
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (r.status !== 0) {
    process.exit(r.status ?? 1);
  }
}

function findNewestApk(dir) {
  if (!existsSync(dir)) return null;
  const apks = readdirSync(dir)
    .filter((f) => f.endsWith(".apk") && !f.endsWith("-unsigned.apk"))
    .map((f) => join(dir, f))
    .filter((p) => existsSync(p));
  if (apks.length === 0) return null;
  apks.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  return apks[0];
}

const variant = resolveVariant();
const version = readVersion();
const slug = variantSlug(variant);
process.env.APP_VARIANT = variant;

console.log(`\n[chrona] Building ${variant} APK · version ${version} · ${buildType}\n`);

if (!skipPrebuild) {
  // --clean so package id / applicationId switches apply when flipping variants
  run(
    "pnpm",
    ["exec", "expo", "prebuild", "--platform", "android", "--clean", "--non-interactive"],
    { env: { APP_VARIANT: variant } },
  );
} else if (!existsSync(androidRoot)) {
  console.error("[chrona] android/ missing — run without --skip-prebuild first");
  process.exit(1);
}

// Raise Gradle heap after prebuild (Expo default Metaspace often OOMs on CI)
const gradleProps = join(androidRoot, "gradle.properties");
if (existsSync(gradleProps) && process.env.CI === "true") {
  try {
    let props = readFileSync(gradleProps, "utf8");
    const jvm =
      "org.gradle.jvmargs=-Xmx6g -XX:MaxMetaspaceSize=2g -XX:ReservedCodeCacheSize=512m -Dfile.encoding=UTF-8";
    if (/^org\.gradle\.jvmargs=/m.test(props)) {
      props = props.replace(/^org\.gradle\.jvmargs=.*$/m, jvm);
    } else {
      props += `\n${jvm}\n`;
    }
    if (!props.includes("org.gradle.workers.max")) {
      props +=
        "\norg.gradle.workers.max=2\norg.gradle.parallel=false\norg.gradle.daemon=false\nkotlin.daemon.jvmargs=-Xmx2g -XX:MaxMetaspaceSize=1g\n";
    }
    writeFileSync(gradleProps, props, "utf8");
    console.log("[chrona] CI: raised Gradle memory in gradle.properties");
  } catch (e) {
    console.warn("[chrona] could not patch gradle.properties", e);
  }
}

const gradleTask = buildType === "debug" ? "assembleDebug" : "assembleRelease";
run("chmod", ["+x", "gradlew"], { cwd: androidRoot });
run("./gradlew", [gradleTask], {
  cwd: androidRoot,
  env: {
    APP_VARIANT: variant,
  },
});

const apkDir = join(
  androidRoot,
  "app/build/outputs/apk",
  buildType === "debug" ? "debug" : "release",
);
const src = findNewestApk(apkDir);
if (!src) {
  console.error(`[chrona] No APK found under ${apkDir}`);
  process.exit(1);
}

mkdirSync(distDir, { recursive: true });
const outName = `chrona-${version}-${slug}.apk`;
const dest = join(distDir, outName);
copyFileSync(src, dest);

const sizeMb = (statSync(dest).size / (1024 * 1024)).toFixed(1);
console.log(`\n[chrona] APK ready: ${dest} (${sizeMb} MiB)`);
console.log(`[chrona] Install: adb install -r ${dest}\n`);
