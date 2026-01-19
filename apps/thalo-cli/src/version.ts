import { exec } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { isInitialized, isUsingNative } from "@rejot-dev/thalo/node";

const execAsync = promisify(exec);

// Compute package root once at module level
// In dist/, go up one level to find package.json
// In src/, go up one level to find package.json
const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(__dirname, "..");

/**
 * Get the package version from package.json
 */
async function getPackageVersion(): Promise<string> {
  try {
    const packageJsonPath = join(packageRoot, "package.json");
    const content = await readFile(packageJsonPath, "utf-8");
    const pkg = JSON.parse(content);
    return pkg.version || "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Get git commit hash if running from a git repository
 */
async function getGitHash(): Promise<string | null> {
  try {
    const { stdout } = await execAsync("git rev-parse --short HEAD", { cwd: packageRoot });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Check if there are uncommitted changes in the git repo
 */
async function isGitDirty(): Promise<boolean> {
  try {
    const { stdout } = await execAsync("git status --porcelain", { cwd: packageRoot });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Get the parser backend being used (native, wasm, or unknown if not initialized)
 */
function getParserBackend(): "native" | "wasm" | "unknown" {
  if (!isInitialized()) {
    return "unknown";
  }
  return isUsingNative() ? "native" : "wasm";
}

/**
 * Version info structure
 */
export interface VersionInfo {
  version: string;
  gitHash: string | null;
  gitDirty: boolean;
  parserBackend: "native" | "wasm" | "unknown";
}

/**
 * Get all version information
 */
export async function getVersionInfo(): Promise<VersionInfo> {
  const [version, gitHash, gitDirty] = await Promise.all([
    getPackageVersion(),
    getGitHash(),
    isGitDirty(),
  ]);

  return {
    version,
    gitHash,
    gitDirty,
    parserBackend: getParserBackend(),
  };
}

/**
 * Format version info as a string for display
 */
export function formatVersion(info: VersionInfo): string {
  let versionStr = `thalo v${info.version}`;

  if (info.gitHash) {
    versionStr += ` (${info.gitHash}${info.gitDirty ? "-dirty" : ""})`;
  }

  versionStr += ` [${info.parserBackend}]`;

  return versionStr;
}
