#!/usr/bin/env tsx
/**
 * Test that the Prettier plugin works with WASM fallback when native compilation fails.
 *
 * This script:
 * 1. Packs the grammar + thalo-prettier packages
 * 2. Installs them in a temp directory with --ignore-scripts (simulating failed native build)
 * 3. Runs Prettier formatting using the plugin
 *
 * Run: pnpm --filter @rejot-dev/scripts test:prettier-wasm-fallback
 */

import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, platform } from "node:os";

const IS_WINDOWS = platform() === "win32";

function quotePath(p: string): string {
  if (IS_WINDOWS) {
    return `"${p.replace(/"/g, '""')}"`;
  }
  return `'${p.replace(/'/g, "'\\''")}'`;
}

const PACKAGES_TO_PACK = ["packages/grammar", "packages/thalo-prettier"];

const TEST_INPUT = `2026-01-05T18:00Z create lore "MSc Software Engineering" #education\n  type: "fact"\n  subject: ^self\n\n  # Description\n  Completed MSc Software Engineering at the University of Amsterdam.\n`;

const EXPECTED_OUTPUT = `2026-01-05T18:00Z create lore "MSc Software Engineering" #education\n  type: "fact"\n  subject: ^self\n\n  # Description\n  Completed MSc Software Engineering at the University of Amsterdam.\n`;

function run(cmd: string, options?: { cwd?: string; stdio?: "inherit" | "pipe" }): string {
  console.log(`$ ${cmd}`);
  const result = execSync(cmd, {
    cwd: options?.cwd,
    stdio: options?.stdio ?? "pipe",
    encoding: "utf-8",
  });
  return result?.toString() ?? "";
}

function findWorkspaceRoot(): string {
  let dir = process.cwd();
  let prevDir = "";
  while (dir !== prevDir) {
    if (existsSync(join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    prevDir = dir;
    dir = join(dir, "..");
  }
  throw new Error("Could not find workspace root (pnpm-workspace.yaml)");
}

function main() {
  const testDir = join(tmpdir(), `thalo-prettier-wasm-test-${Date.now()}`);
  const packDir = join(testDir, "packs");
  const projectDir = join(testDir, "project");

  console.log("🧪 Testing thalo-prettier WASM fallback...\n");
  console.log(`📁 Test directory: ${testDir}\n`);

  try {
    mkdirSync(packDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });

    const workspaceRoot = findWorkspaceRoot();

    console.log("📦 Packing packages...\n");
    for (const pkg of PACKAGES_TO_PACK) {
      const pkgPath = join(workspaceRoot, pkg);
      run(`pnpm pack --pack-destination ${quotePath(packDir)}`, { cwd: pkgPath });
    }

    console.log("\n📋 Initializing test project...\n");
    run("npm init -y", { cwd: projectDir });

    console.log("\n📥 Installing packages (without native compilation)...\n");
    const tgzFiles = readdirSync(packDir)
      .filter((f) => f.endsWith(".tgz"))
      .map((f) => quotePath(join(packDir, f)))
      .join(" ");
    run(`npm install --ignore-scripts prettier ${tgzFiles}`, { cwd: projectDir });

    console.log("\n🧹 Writing format script...\n");
    const scriptPath = join(projectDir, "format.mjs");
    writeFileSync(
      scriptPath,
      `import prettier from "prettier";\n` +
        `import * as plugin from "@rejot-dev/thalo-prettier";\n` +
        `\n` +
        `const input = ${JSON.stringify(TEST_INPUT)};\n` +
        `const expected = ${JSON.stringify(EXPECTED_OUTPUT)};\n` +
        `const output = await prettier.format(input, { parser: "thalo", plugins: [plugin] });\n` +
        `if (output !== expected) {\n` +
        `  console.error("Unexpected formatted output.");\n` +
        `  console.error("--- expected ---\\n" + expected);\n` +
        `  console.error("--- received ---\\n" + output);\n` +
        `  process.exit(1);\n` +
        `}\n` +
        `console.log("✓ Prettier formatting succeeded with WASM fallback.");\n`,
    );

    console.log("\n✅ Running formatter...\n");
    run(`node ${quotePath(scriptPath)}`, { cwd: projectDir, stdio: "inherit" });

    console.log("\n🎉 SUCCESS: thalo-prettier works with WASM fallback!\n");
  } finally {
    console.log("🧹 Cleaning up...");
    rmSync(testDir, { recursive: true, force: true });
  }
}

main();
