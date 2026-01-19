#!/usr/bin/env tsx
/**
 * Test that the CLI works with WASM fallback when native compilation fails.
 *
 * This script:
 * 1. Packs the CLI and its dependencies
 * 2. Installs them in a temp directory with --ignore-scripts (simulating failed native build)
 * 3. Verifies the CLI works using WASM
 *
 * Run: pnpm test:wasm-fallback
 */

import { execSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { tmpdir, platform } from "node:os";

const IS_WINDOWS = platform() === "win32";

/**
 * Quote a path for shell usage. On Windows, uses double quotes.
 * On Unix, uses single quotes (which don't interpolate).
 */
function quotePath(p: string): string {
  if (IS_WINDOWS) {
    // On Windows, use double quotes and escape any existing double quotes
    return `"${p.replace(/"/g, '""')}"`;
  }
  // On Unix, use single quotes and escape any existing single quotes
  return `'${p.replace(/'/g, "'\\''")}'`;
}

/**
 * Get the path to the thalo CLI binary, accounting for platform differences.
 * On Windows, npm creates .cmd wrapper scripts.
 */
function getThaloBinPath(projectDir: string): string {
  if (IS_WINDOWS) {
    return join(projectDir, "node_modules", ".bin", "thalo.cmd");
  }
  return join(projectDir, "node_modules", ".bin", "thalo");
}

const PACKAGES_TO_PACK = [
  "packages/grammar",
  "packages/thalo",
  "packages/thalo-lsp",
  "apps/thalo-cli",
];

// A minimal valid thalo file for testing (uses actual thalo syntax)
const TEST_THALO_FILE = `2026-01-01T12:00Z define-entity person "A person"
  # Metadata
  name: string

  # Sections
  Bio

2026-01-01T12:01Z create person "John Doe" ^john
  name: "John Doe"

  # Bio
  John is a software developer.
`;

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
  // Use prevDir check instead of "/" to work on Windows
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
  const testDir = join(tmpdir(), `thalo-wasm-test-${Date.now()}`);
  const packDir = join(testDir, "packs");
  const projectDir = join(testDir, "project");

  console.log("🧪 Testing WASM fallback...\n");
  console.log(`📁 Test directory: ${testDir}\n`);

  try {
    // Create directories
    mkdirSync(packDir, { recursive: true });
    mkdirSync(projectDir, { recursive: true });

    // Find workspace root
    const workspaceRoot = findWorkspaceRoot();

    // Pack packages
    console.log("📦 Packing packages...\n");
    for (const pkg of PACKAGES_TO_PACK) {
      const pkgPath = join(workspaceRoot, pkg);
      run(`pnpm pack --pack-destination ${quotePath(packDir)}`, { cwd: pkgPath });
    }

    // Initialize test project
    console.log("\n📋 Initializing test project...\n");
    run("npm init -y", { cwd: projectDir });

    // Install with --ignore-scripts to simulate failed native build
    // Note: Shell glob patterns don't work reliably on Windows, so we list files explicitly
    console.log("\n📥 Installing packages (without native compilation)...\n");
    const tgzFiles = readdirSync(packDir)
      .filter((f) => f.endsWith(".tgz"))
      .map((f) => quotePath(join(packDir, f)))
      .join(" ");
    run(`npm install --ignore-scripts ${tgzFiles}`, { cwd: projectDir });

    // Check version
    console.log("\n🔍 Checking CLI version...\n");
    const thaloBin = quotePath(getThaloBinPath(projectDir));
    const version = run(`${thaloBin} --version`, { cwd: projectDir });
    console.log(`   ${version.trim()}`);

    if (!version.includes("[wasm]")) {
      throw new Error(
        "Expected [wasm] in version output. The CLI is not using WASM fallback as expected.",
      );
    }

    // Create test file
    const testFile = join(projectDir, "test.thalo");
    writeFileSync(testFile, TEST_THALO_FILE);

    // Run check command
    console.log("\n✅ Testing check command...\n");
    const checkResult = run(`${thaloBin} check ${quotePath(testFile)}`, { cwd: projectDir });
    console.log(`   ${checkResult.trim()}`);

    console.log("\n🎉 SUCCESS: WASM fallback works correctly!\n");
  } finally {
    // Cleanup
    console.log("🧹 Cleaning up...");
    rmSync(testDir, { recursive: true, force: true });
  }
}

main();
