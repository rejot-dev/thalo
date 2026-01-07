#!/usr/bin/env node
/**
 * Checks if node-gyp rebuild is needed by comparing mtimes of:
 * - Source files: grammar.js, src/parser.c, src/scanner.c, bindings/node/binding.cc
 * - Output file: build/Release/tree_sitter_ptall_binding.node
 */
import { statSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

const outputFile = join(root, "build/Release/tree_sitter_ptall_binding.node");
const sourceFiles = [
  join(root, "grammar.js"),
  join(root, "src/parser.c"),
  join(root, "src/scanner.c"),
  join(root, "bindings/node/binding.cc"),
];

function getMtime(path) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

function needsRebuild() {
  if (!existsSync(outputFile)) {
    return { needed: true, reason: ".node file does not exist" };
  }

  const outputMtime = getMtime(outputFile);

  for (const src of sourceFiles) {
    const srcMtime = getMtime(src);
    if (srcMtime > outputMtime) {
      return { needed: true, reason: `${src} is newer than .node file` };
    }
  }

  return { needed: false };
}

const result = needsRebuild();

if (result.needed) {
  console.log(`⚠️  node-gyp rebuild needed: ${result.reason}`);

  if (process.argv.includes("--fix")) {
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
