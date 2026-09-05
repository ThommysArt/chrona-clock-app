#!/usr/bin/env node
/**
 * Remove Gradle build outputs that accumulate inside node_modules.
 *
 * Every local Android build (expo run:android, ./gradlew assemble*) compiles
 * each native module in place, leaving multi-GB `android/build` and
 * `android/.cxx` directories inside node_modules (nested under .pnpm with
 * pnpm's isolated linker, at top level with the hoisted linker). pnpm can
 * never deduplicate these: they are generated locally, never installed, so
 * each project carries its own private copy.
 *
 * Only `android/build` and `android/.cxx` directories located under a
 * `node_modules` tree are removed. The app's own `android/build` directory
 * (which holds the APK outputs) is never touched.
 *
 * Usage:
 *   node scripts/clean-node-modules-build.mjs [projectRoot]
 *
 * Set KEEP_NATIVE_BUILD=1 to skip (keeps outputs for faster incremental
 * Gradle rebuilds, at the cost of disk).
 */

import { existsSync, lstatSync, readdirSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const SWEEP_NAMES = ["build", ".cxx"];

function dirSizeBytes(dir) {
  let total = 0;
  const stack = [dir];
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = join(cur, e.name);
      let st;
      try {
        st = lstatSync(p);
      } catch {
        continue;
      }
      total += st.size;
      if (st.isDirectory() && !e.isSymbolicLink()) stack.push(p);
    }
  }
  return total;
}

function candidateRoots(projectRoot) {
  const roots = [join(projectRoot, "node_modules")];
  for (const sub of ["apps", "packages"]) {
    const parent = join(projectRoot, sub);
    let entries;
    try {
      entries = readdirSync(parent, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (e.isDirectory() && !e.isSymbolicLink()) {
        roots.push(join(parent, e.name, "node_modules"));
      }
    }
  }
  return roots.filter((d) => existsSync(d));
}

function sweepTree(nmRoot, onRemove) {
  const stack = [nmRoot];
  while (stack.length > 0) {
    const cur = stack.pop();
    let entries;
    try {
      entries = readdirSync(cur, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory() && !e.isSymbolicLink()) continue;
      const p = join(cur, e.name);
      if (e.name === "android" && e.isDirectory() && !e.isSymbolicLink()) {
        for (const target of SWEEP_NAMES) {
          const t = join(p, target);
          if (existsSync(t)) onRemove(t);
        }
      }
      if (!e.isSymbolicLink()) stack.push(p);
    }
  }
}

export function cleanNodeModulesBuild(projectRoot) {
  const root = resolve(projectRoot);
  let removed = 0;
  let bytes = 0;
  for (const nm of candidateRoots(root)) {
    sweepTree(nm, (target) => {
      try {
        bytes += dirSizeBytes(target);
        rmSync(target, { recursive: true, force: true });
        removed += 1;
      } catch {
        // best effort; leave whatever failed in place
      }
    });
  }
  return { removed, bytes };
}

function formatBytes(n) {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(1)} GiB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MiB`;
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KiB`;
  return `${n} B`;
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  if (process.env.KEEP_NATIVE_BUILD === "1") {
    console.log("[clean] KEEP_NATIVE_BUILD=1 — leaving Gradle outputs in place.");
  } else {
    const scriptDir = dirname(fileURLToPath(import.meta.url));
    const root = resolve(process.argv[2] || join(scriptDir, ".."));
    const { removed, bytes } = cleanNodeModulesBuild(root);
    console.log(
      `[clean] removed ${removed} Gradle output dirs under node_modules (~${formatBytes(bytes)} reclaimed).`,
    );
  }
}
