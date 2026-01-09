#!/usr/bin/env node
/**
 * Checks if rebuilds are needed by comparing mtimes of source files vs output files.
 *
 * Checks:
 * - Native binding: build/Release/tree_sitter_thalo_binding.node
 * - WASM module: tree-sitter-thalo.wasm
 *
 * Source files: grammar.js, src/parser.c, src/scanner.c
 */
import { statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

// Source files that affect both native and WASM builds
const sourceFiles = [
  join(root, "grammar.js"),
  join(root, "src/parser.c"),
  join(root, "src/scanner.c"),
];

// Native-specific source
const nativeSourceFiles = [...sourceFiles, join(root, "bindings/node/binding.cc")];

const nativeOutput = join(root, "build/Release/tree_sitter_thalo_binding.node");
const wasmOutput = join(root, "tree-sitter-thalo.wasm");

function getMtime(path) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function checkNeedsRebuild(outputFile, sources, name) {
  if (!existsSync(outputFile)) {
    return { needed: true, reason: `${name} does not exist` };
  }

  const outputMtime = getMtime(outputFile);

  for (const src of sources) {
    const srcMtime = getMtime(src);
    if (srcMtime > outputMtime) {
      return { needed: true, reason: `${src} is newer than ${name}` };
    }
  }

  return { needed: false };
}

const fix = process.argv.includes("--fix");

// Check native binding
const nativeResult = checkNeedsRebuild(nativeOutput, nativeSourceFiles, ".node file");

if (nativeResult.needed) {
  console.log(`⚠️  node-gyp rebuild needed: ${nativeResult.reason}`);

  if (fix) {
    console.log("Running node-gyp rebuild...");
    execSync("pnpm exec node-gyp rebuild", { cwd: root, stdio: "inherit" });
    console.log("✅ Rebuild complete");
  } else {
    console.log("Run with --fix to automatically rebuild, or run: pnpm build:native");
    process.exit(1);
  }
} else {
  console.log("✅ Native binding is up to date");
}

// Check WASM module
const wasmResult = checkNeedsRebuild(wasmOutput, sourceFiles, ".wasm file");

if (wasmResult.needed) {
  console.log(`⚠️  WASM rebuild needed: ${wasmResult.reason}`);

  if (fix) {
    console.log("Running pnpm build:wasm...");
    execSync("pnpm build:wasm", { cwd: root, stdio: "inherit" });
    console.log("✅ WASM rebuild complete");
  } else {
    console.log("Run with --fix to automatically rebuild, or run: pnpm build:wasm");
    process.exit(1);
  }
} else {
  console.log("✅ WASM module is up to date");
}
