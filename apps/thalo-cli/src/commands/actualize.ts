import * as fs from "node:fs";
import * as path from "node:path";
import {
  Workspace,
  executeQueries,
  formatQuery,
  isSyntaxError,
  type Query,
  type QueryCondition,
  type SynthesisEntry,
  type ActualizeEntry,
  type InstanceEntry,
  type Timestamp,
  type AstQuery,
  type AstQueryCondition,
} from "@rejot-dev/thalo";
import pc from "picocolors";
import type { CommandDef, CommandContext } from "../cli.js";

/**
 * Format a timestamp to string
 */
function formatTimestamp(ts: Timestamp): string {
  const date = `${ts.date.year}-${String(ts.date.month).padStart(2, "0")}-${String(ts.date.day).padStart(2, "0")}`;
  const time = `${String(ts.time.hour).padStart(2, "0")}:${String(ts.time.minute).padStart(2, "0")}`;
  const tz = isSyntaxError(ts.timezone) ? "" : ts.timezone.value;
  return `${date}T${time}${tz}`;
}

/**
 * Collect all thalo and markdown files from a directory
 */
function collectThaloFiles(dir: string, extensions: string[] = [".thalo", ".md"]): string[] {
  const files: string[] = [];

  function walk(currentDir: string): void {
    let entries;
    try {
      entries = fs.readdirSync(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        if (!entry.name.startsWith(".") && entry.name !== "node_modules") {
          walk(fullPath);
        }
      } else if (entry.isFile()) {
        if (extensions.some((ext) => entry.name.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    }
  }

  walk(dir);
  return files;
}

/**
 * Resolve file paths from command arguments
 */
function resolveFiles(paths: string[]): string[] {
  const files: string[] = [];

  for (const targetPath of paths) {
    const resolved = path.resolve(targetPath);

    if (!fs.existsSync(resolved)) {
      console.error(pc.red(`Error: Path not found: ${targetPath}`));
      process.exit(2);
    }

    const stat = fs.statSync(resolved);
    if (stat.isDirectory()) {
      files.push(...collectThaloFiles(resolved));
    } else if (stat.isFile()) {
      files.push(resolved);
    }
  }

  return files;
}

/**
 * Load workspace from files
 */
function loadWorkspace(files: string[]): Workspace {
  const workspace = new Workspace();

  for (const file of files) {
    try {
      const source = fs.readFileSync(file, "utf-8");
      workspace.addDocument(source, { filename: file });
    } catch (err) {
      console.error(pc.red(`Error reading ${file}: ${err instanceof Error ? err.message : err}`));
    }
  }

  return workspace;
}

interface SynthesisInfo {
  entry: SynthesisEntry;
  file: string;
  linkId: string;
  title: string;
  sources: Query[];
  prompt: string | null;
}

/**
 * Extract synthesis sources from metadata
 */
function getSynthesisSources(entry: SynthesisEntry): Query[] {
  const sourcesMeta = entry.metadata.find((m) => m.key.value === "sources");
  if (!sourcesMeta) {
    return [];
  }

  const content = sourcesMeta.value.content;
  if (content.type === "query_value") {
    return [astQueryToModelQuery(content.query)];
  }
  if (content.type === "value_array") {
    return content.elements
      .filter((e): e is AstQuery => e.type === "query")
      .map(astQueryToModelQuery);
  }
  return [];
}

/**
 * Convert AST Query to Model Query
 */
function astQueryToModelQuery(astQuery: AstQuery): Query {
  return {
    entity: astQuery.entity,
    conditions: astQuery.conditions.map((c: AstQueryCondition): QueryCondition => {
      switch (c.type) {
        case "field_condition":
          return { kind: "field", field: c.field, value: c.value };
        case "tag_condition":
          return { kind: "tag", tag: c.tag };
        case "link_condition":
          return { kind: "link", link: c.linkId };
        default:
          throw new Error(`Unknown condition type: ${(c as { type: string }).type}`);
      }
    }),
  };
}

/**
 * Extract prompt from synthesis content
 */
function getSynthesisPrompt(entry: SynthesisEntry): string | null {
  if (!entry.content) {
    return null;
  }

  let inPrompt = false;
  const promptLines: string[] = [];

  for (const child of entry.content.children) {
    if (child.type === "markdown_header") {
      const headerText = child.text.toLowerCase();
      if (headerText.includes("prompt")) {
        inPrompt = true;
      } else {
        inPrompt = false;
      }
    } else if (child.type === "content_line" && inPrompt) {
      promptLines.push(child.text);
    }
  }

  return promptLines.length > 0 ? promptLines.join("\n").trim() : null;
}

/**
 * Find all synthesis definitions in the workspace
 */
function findSyntheses(workspace: Workspace): SynthesisInfo[] {
  const syntheses: SynthesisInfo[] = [];

  for (const model of workspace.allModels()) {
    for (const entry of model.ast.entries) {
      if (entry.type === "synthesis_entry") {
        syntheses.push({
          entry,
          file: model.file,
          linkId: entry.header.linkId.id,
          title: entry.header.title?.value ?? "(no title)",
          sources: getSynthesisSources(entry),
          prompt: getSynthesisPrompt(entry),
        });
      }
    }
  }

  return syntheses;
}

interface ActualizeInfo {
  entry: ActualizeEntry;
  file: string;
  target: string;
  timestamp: string;
}

/**
 * Find the latest actualize entry for a synthesis
 */
function findLatestActualize(workspace: Workspace, synthesisLinkId: string): ActualizeInfo | null {
  let latest: ActualizeInfo | null = null;

  for (const model of workspace.allModels()) {
    for (const entry of model.ast.entries) {
      if (entry.type !== "actualize_entry") {
        continue;
      }
      if (entry.header.target.id !== synthesisLinkId) {
        continue;
      }

      const ts = formatTimestamp(entry.header.timestamp);
      if (!latest || ts > latest.timestamp) {
        latest = {
          entry,
          file: model.file,
          target: entry.header.target.id,
          timestamp: ts,
        };
      }
    }
  }

  return latest;
}

/**
 * Get the 'updated' timestamp from an actualize entry
 */
function getUpdatedTimestamp(actualize: ActualizeInfo | null): string | null {
  if (!actualize) {
    return null;
  }
  const updated = actualize.entry.metadata.find((m) => m.key.value === "updated");
  return updated?.value.raw ?? null;
}

/**
 * Find which file an entry belongs to by matching location
 */
function findEntryFile(workspace: Workspace, entry: InstanceEntry): string | undefined {
  for (const model of workspace.allModels()) {
    for (const e of model.ast.entries) {
      if (
        e.type === "instance_entry" &&
        e.location.startIndex === entry.location.startIndex &&
        e.location.endIndex === entry.location.endIndex
      ) {
        return model.file;
      }
    }
  }
  return undefined;
}

/**
 * Get raw entry text from source file
 */
function getEntryRawText(entry: InstanceEntry, file: string): string {
  try {
    const source = fs.readFileSync(file, "utf-8");
    const start = entry.location.startIndex;
    const end = entry.location.endIndex;
    return source.slice(start, end).trim();
  } catch {
    return `[Could not read entry from ${file}]`;
  }
}

/**
 * Relative path from cwd
 */
function relativePath(filePath: string): string {
  const cwd = process.cwd();
  if (filePath.startsWith(cwd)) {
    const rel = filePath.slice(cwd.length + 1);
    return rel || filePath;
  }
  return filePath;
}

function actualizeAction(ctx: CommandContext): void {
  const { args } = ctx;

  // Determine target paths
  const targetPaths = args.length > 0 ? args : ["."];

  // Collect and load files
  const files = resolveFiles(targetPaths);
  if (files.length === 0) {
    console.log("No .thalo or .md files found.");
    process.exit(0);
  }

  const workspace = loadWorkspace(files);

  // Find all synthesis definitions
  const syntheses = findSyntheses(workspace);

  if (syntheses.length === 0) {
    console.log(pc.dim("No synthesis definitions found."));
    process.exit(0);
  }

  let hasOutput = false;

  for (const synthesis of syntheses) {
    // Find latest actualize entry
    const lastActualize = findLatestActualize(workspace, synthesis.linkId);
    const lastUpdated = getUpdatedTimestamp(lastActualize);

    // Query for new entries
    const newEntries = executeQueries(workspace, synthesis.sources, {
      afterTimestamp: lastUpdated ?? undefined,
    });

    if (newEntries.length === 0) {
      console.log(pc.green(`✓ ${relativePath(synthesis.file)}: ${synthesis.title} - up to date`));
      continue;
    }

    hasOutput = true;

    // Output synthesis header
    console.log();
    console.log(
      pc.bold(pc.cyan(`=== Synthesis: ${synthesis.title} (${relativePath(synthesis.file)}) ===`)),
    );
    console.log(`Target: ${pc.yellow(`^${synthesis.linkId}`)}`);
    console.log(`Sources: ${synthesis.sources.map(formatQuery).join(", ")}`);
    if (lastUpdated) {
      console.log(`Last updated: ${pc.dim(lastUpdated)}`);
    }

    // Output prompt
    console.log();
    console.log(pc.bold("--- User Prompt ---"));
    console.log(synthesis.prompt || pc.dim("(no prompt defined)"));

    // Output new entries
    console.log();
    console.log(pc.bold(`--- New Entries (${newEntries.length}) ---`));
    for (const entry of newEntries) {
      const entryFile = findEntryFile(workspace, entry);
      console.log();
      if (!entryFile) {
        console.log(pc.dim("[Could not locate entry file]"));
        continue;
      }
      console.log(getEntryRawText(entry, entryFile));
    }

    // Output instructions
    console.log();
    console.log(pc.bold("--- Instructions ---"));
    console.log(
      `1. Update the content directly below the \`\`\`thalo block in ${relativePath(synthesis.file)}`,
    );
    console.log(`2. Place output BEFORE any subsequent \`\`\`thalo blocks`);
    console.log(
      `3. Append to the thalo block: ${pc.cyan(`actualize-synthesis ^${synthesis.linkId}`)}`,
    );
    console.log(`   with metadata: ${pc.cyan("updated: <current-timestamp>")}`);
    console.log();
    console.log(pc.dim("─".repeat(60)));
  }

  if (!hasOutput) {
    console.log();
    console.log(pc.green("All syntheses are up to date."));
  }
}

export const actualizeCommand: CommandDef = {
  name: "actualize",
  description: "Output prompts and entries for pending synthesis updates",
  args: {
    name: "paths",
    description: "Files or directories to check for syntheses",
    required: false,
    multiple: true,
  },
  options: {},
  action: actualizeAction,
};
