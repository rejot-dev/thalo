"use client";

/**
 * Thalo Runner - Executes thalo commands on playground content.
 *
 * Provides browser-compatible implementations of check, query, and actualize
 * commands using the web-tree-sitter parser.
 */

import type { Tree } from "@rejot-dev/thalo/web";
import { getParser, type ThaloParser } from "@/lib/thalo-parser.client";

// Virtual filenames for the playground
const FILES = {
  entities: "entities.thalo",
  entries: "entries.thalo",
  synthesis: "syntheses.thalo",
} as const;

// ===================
// Types
// ===================

export type CommandType = "check" | "query" | "actualize";

export interface TerminalLine {
  type: "header" | "info" | "error" | "warning" | "success" | "dim" | "entry" | "prompt" | "blank";
  text: string;
}

export interface CommandResult {
  command: string;
  lines: TerminalLine[];
}

export interface PlaygroundContent {
  entities: string;
  entries: string;
  synthesis: string;
}

// Simplified internal types for our use case
interface SimpleQuery {
  entity: string;
  conditions: SimpleQueryCondition[];
}

interface SimpleQueryCondition {
  kind: "field" | "tag" | "link";
  field?: string;
  value?: string;
  tag?: string;
  link?: string;
}

interface SimpleEntry {
  type: "instance" | "schema" | "synthesis" | "actualize";
  timestamp: string;
  directive: string;
  entity?: string;
  title: string;
  linkId?: string;
  tags: string[];
  metadata: Map<string, string>;
  content: string[];
  sources?: SimpleQuery[];
  prompt?: string;
  startIndex: number;
  endIndex: number;
  startLine: number;
}

interface ParsedDocument {
  file: string;
  source: string;
  entries: SimpleEntry[];
  syntaxErrors: SyntaxError[];
}

interface SyntaxError {
  file: string;
  message: string;
  line: number;
  column: number;
}

// ===================
// AST Node Interface
// ===================

interface AnyNode {
  type: string;
  text: string;
  namedChildren: AnyNode[];
  startIndex: number;
  endIndex: number;
  startPosition: { row: number; column: number };
  endPosition: { row: number; column: number };
  childForFieldName: (name: string) => AnyNode | null;
  hasError?: boolean;
}

// ===================
// Parsing
// ===================

async function parseDocument(
  parser: ThaloParser<Tree>,
  file: string,
  source: string,
): Promise<ParsedDocument> {
  const tree = parser.parse(source);
  const rootNode = tree.rootNode as unknown as AnyNode;

  const entries: SimpleEntry[] = [];
  const syntaxErrors: SyntaxError[] = [];

  for (const child of rootNode.namedChildren) {
    if (child.type === "entry") {
      const entry = extractEntry(child, source);
      if (entry) {
        entries.push(entry);
      }
    } else if (child.type === "ERROR") {
      syntaxErrors.push({
        file,
        message: `Parse error: unexpected content "${child.text.slice(0, 50)}${child.text.length > 50 ? "..." : ""}"`,
        line: child.startPosition.row + 1,
        column: child.startPosition.column + 1,
      });
    }
  }

  // Check for errors in the tree
  if (rootNode.hasError && syntaxErrors.length === 0) {
    // Find ERROR nodes recursively
    const findErrors = (node: AnyNode): void => {
      if (node.type === "ERROR") {
        syntaxErrors.push({
          file,
          message: `Syntax error near: "${node.text.slice(0, 30)}${node.text.length > 30 ? "..." : ""}"`,
          line: node.startPosition.row + 1,
          column: node.startPosition.column + 1,
        });
      }
      for (const child of node.namedChildren) {
        findErrors(child);
      }
    };
    findErrors(rootNode);
  }

  return { file, source, entries, syntaxErrors };
}

function extractEntry(node: AnyNode, source: string): SimpleEntry | null {
  const child = node.namedChildren[0];
  if (!child) {
    return null;
  }

  if (child.type === "data_entry") {
    return extractDataEntry(child, source);
  }
  if (child.type === "schema_entry") {
    return extractSchemaEntry(child, source);
  }
  return null;
}

function extractDataEntry(node: AnyNode, _source: string): SimpleEntry {
  const directiveNode = node.childForFieldName("directive");
  const directive = directiveNode?.text || "create";
  const timestampNode = node.childForFieldName("timestamp");
  const argumentNode = node.childForFieldName("argument");
  const titleNode = node.childForFieldName("title");

  const linkNodes = node.namedChildren.filter((c) => c.type === "link");
  const tagNodes = node.namedChildren.filter((c) => c.type === "tag");
  const metadataNodes = node.namedChildren.filter((c) => c.type === "metadata");
  const contentNode = node.namedChildren.find((c) => c.type === "content");

  // Extract metadata as Map
  const metadata = new Map<string, string>();
  for (const m of metadataNodes) {
    const keyNode = m.childForFieldName("key");
    const valueNode = m.childForFieldName("value");
    if (keyNode && valueNode) {
      metadata.set(keyNode.text, valueNode.text.trim());
    }
  }

  // Extract content lines
  const content: string[] = [];
  let prompt: string | undefined;
  if (contentNode) {
    let inPrompt = false;
    const promptLines: string[] = [];

    for (const c of contentNode.namedChildren) {
      if (c.type === "markdown_header") {
        if (c.text.toLowerCase().includes("prompt")) {
          inPrompt = true;
        } else {
          inPrompt = false;
        }
        content.push(c.text);
      } else if (c.type === "content_line") {
        content.push(c.text);
        if (inPrompt) {
          promptLines.push(c.text);
        }
      }
    }

    if (promptLines.length > 0) {
      prompt = promptLines.join("\n").trim();
    }
  }

  // Determine type based on directive
  let type: SimpleEntry["type"] = "instance";
  let linkId: string | undefined;
  let sources: SimpleQuery[] | undefined;

  if (directive === "define-synthesis") {
    type = "synthesis";
    const linkIdNode = argumentNode?.type === "link" ? argumentNode : linkNodes[0];
    linkId = linkIdNode ? linkIdNode.text.slice(1) : undefined;

    // Extract sources from metadata
    const sourcesValue = metadata.get("sources");
    if (sourcesValue) {
      sources = parseQueryFromText(sourcesValue);
    }
  } else if (directive === "actualize-synthesis") {
    type = "actualize";
    const targetNode = argumentNode?.type === "link" ? argumentNode : linkNodes[0];
    linkId = targetNode ? targetNode.text.slice(1) : undefined;
  }

  return {
    type,
    timestamp: timestampNode?.text || "",
    directive,
    entity: type === "instance" ? argumentNode?.text : undefined,
    title: titleNode ? stripQuotes(titleNode.text) : "",
    linkId:
      linkId ??
      (linkNodes.length > 0 && type === "instance" ? linkNodes[0].text.slice(1) : undefined),
    tags: tagNodes.map((t) => t.text.slice(1)),
    metadata,
    content,
    sources,
    prompt,
    startIndex: node.startIndex,
    endIndex: node.endIndex,
    startLine: node.startPosition.row + 1,
  };
}

function extractSchemaEntry(node: AnyNode, _source: string): SimpleEntry {
  const directiveNode = node.childForFieldName("directive");
  const timestampNode = node.childForFieldName("timestamp");
  const argumentNode = node.childForFieldName("argument");
  const titleNode = node.childForFieldName("title");
  const tagNodes = node.namedChildren.filter((c) => c.type === "tag");
  const linkNodes = node.namedChildren.filter((c) => c.type === "link");

  return {
    type: "schema",
    timestamp: timestampNode?.text || "",
    directive: directiveNode?.text || "define-entity",
    entity: argumentNode?.text,
    title: titleNode ? stripQuotes(titleNode.text) : "",
    linkId: linkNodes.length > 0 ? linkNodes[0].text.slice(1) : undefined,
    tags: tagNodes.map((t) => t.text.slice(1)),
    metadata: new Map(),
    content: [],
    startIndex: node.startIndex,
    endIndex: node.endIndex,
    startLine: node.startPosition.row + 1,
  };
}

function parseQueryFromText(text: string): SimpleQuery[] {
  // Simple query parsing from metadata value
  // Expected format: "entity where #tag" or "entity where condition"
  const trimmed = text.trim();

  const match = trimmed.match(/^(\S+)(?:\s+where\s+(.+))?$/);
  if (!match) {
    return [{ entity: trimmed, conditions: [] }];
  }

  const [, entity, conditionsStr] = match;
  const conditions: SimpleQueryCondition[] = [];

  if (conditionsStr) {
    const parts = conditionsStr.split(/\s+and\s+/);
    for (const part of parts) {
      const p = part.trim();
      if (p.startsWith("#")) {
        conditions.push({ kind: "tag", tag: p.slice(1) });
      } else if (p.startsWith("^")) {
        conditions.push({ kind: "link", link: p.slice(1) });
      } else {
        const fieldMatch = p.match(/^(\S+)\s*=\s*(.+)$/);
        if (fieldMatch) {
          conditions.push({ kind: "field", field: fieldMatch[1], value: fieldMatch[2] });
        }
      }
    }
  }

  return [{ entity, conditions }];
}

function stripQuotes(text: string): string {
  if (text.startsWith('"') && text.endsWith('"')) {
    return text.slice(1, -1);
  }
  return text;
}

// ===================
// Query Execution
// ===================

function entryMatchesQuery(entry: SimpleEntry, query: SimpleQuery): boolean {
  if (entry.type !== "instance") {
    return false;
  }
  if (entry.entity !== query.entity) {
    return false;
  }

  return query.conditions.every((condition) => {
    switch (condition.kind) {
      case "tag":
        return entry.tags.includes(condition.tag!);
      case "link":
        return entry.linkId === condition.link;
      case "field": {
        const value = entry.metadata.get(condition.field!);
        return value === condition.value;
      }
    }
  });
}

function executeQuery(docs: ParsedDocument[], query: SimpleQuery): SimpleEntry[] {
  const results: SimpleEntry[] = [];

  for (const doc of docs) {
    for (const entry of doc.entries) {
      if (entryMatchesQuery(entry, query)) {
        results.push(entry);
      }
    }
  }

  return results;
}

function formatQuery(query: SimpleQuery): string {
  let result = query.entity;

  if (query.conditions.length > 0) {
    const condStrs = query.conditions.map((c) => {
      switch (c.kind) {
        case "field":
          return `${c.field} = ${c.value}`;
        case "tag":
          return `#${c.tag}`;
        case "link":
          return `^${c.link}`;
      }
    });
    result += ` where ${condStrs.join(" and ")}`;
  }

  return result;
}

// ===================
// Command Runners
// ===================

async function runCheck(content: PlaygroundContent): Promise<CommandResult> {
  const parser = await getParser();

  const docs = await Promise.all([
    parseDocument(parser, FILES.entities, content.entities),
    parseDocument(parser, FILES.entries, content.entries),
    parseDocument(parser, FILES.synthesis, content.synthesis),
  ]);

  const lines: TerminalLine[] = [];
  lines.push({ type: "header", text: "=== Running check ===" });
  lines.push({ type: "blank", text: "" });

  // Collect all errors
  const allErrors: SyntaxError[] = [];
  for (const doc of docs) {
    allErrors.push(...doc.syntaxErrors);
  }

  if (allErrors.length === 0) {
    let entryCount = 0;
    for (const doc of docs) {
      entryCount += doc.entries.length;
    }

    lines.push({ type: "success", text: "✓ No syntax errors found" });
    lines.push({
      type: "info",
      text: `  ${docs.length} files checked, ${entryCount} entries parsed`,
    });
    lines.push({ type: "blank", text: "" });

    // Show entry summary
    for (const doc of docs) {
      if (doc.entries.length > 0) {
        const schemaCount = doc.entries.filter((e) => e.type === "schema").length;
        const instanceCount = doc.entries.filter((e) => e.type === "instance").length;
        const synthesisCount = doc.entries.filter((e) => e.type === "synthesis").length;

        const parts = [];
        if (schemaCount > 0) {
          parts.push(`${schemaCount} schema`);
        }
        if (instanceCount > 0) {
          parts.push(`${instanceCount} instance`);
        }
        if (synthesisCount > 0) {
          parts.push(`${synthesisCount} synthesis`);
        }

        if (parts.length > 0) {
          lines.push({ type: "dim", text: `  ${doc.file}: ${parts.join(", ")}` });
        }
      }
    }
  } else {
    // Group errors by file
    const byFile = new Map<string, SyntaxError[]>();
    for (const err of allErrors) {
      const existing = byFile.get(err.file) || [];
      existing.push(err);
      byFile.set(err.file, existing);
    }

    for (const [file, fileErrors] of byFile) {
      lines.push({ type: "info", text: file });
      for (const err of fileErrors) {
        lines.push({
          type: "error",
          text: `  ${err.line}:${err.column}  error  ${err.message}`,
        });
      }
      lines.push({ type: "blank", text: "" });
    }

    const errorCount = allErrors.length;
    lines.push({
      type: "error",
      text: `✗ ${errorCount} error${errorCount !== 1 ? "s" : ""} found`,
    });
  }

  return {
    command: "thalo check",
    lines,
  };
}

async function runQuery(content: PlaygroundContent, queryStr?: string): Promise<CommandResult> {
  const parser = await getParser();

  const docs = await Promise.all([
    parseDocument(parser, FILES.entities, content.entities),
    parseDocument(parser, FILES.entries, content.entries),
    parseDocument(parser, FILES.synthesis, content.synthesis),
  ]);

  // If no query provided, try to get one from the first synthesis
  let query: SimpleQuery;
  if (queryStr) {
    const parsed = parseQueryFromText(queryStr);
    query = parsed[0];
  } else {
    // Find first synthesis and use its sources
    let found = false;
    for (const doc of docs) {
      for (const entry of doc.entries) {
        if (entry.type === "synthesis" && entry.sources && entry.sources.length > 0) {
          query = entry.sources[0];
          found = true;
          break;
        }
      }
      if (found) {
        break;
      }
    }
    if (!found) {
      query = { entity: "opinion", conditions: [] };
    }
  }

  const results = executeQuery(docs, query!);
  const lines: TerminalLine[] = [];

  const displayQuery = formatQuery(query!);
  lines.push({ type: "header", text: `=== Query: ${displayQuery} ===` });
  lines.push({ type: "blank", text: "" });
  lines.push({ type: "info", text: `Found: ${results.length} entries` });
  lines.push({ type: "blank", text: "" });

  for (const entry of results) {
    const link = entry.linkId ? ` ^${entry.linkId}` : "";
    const tags = entry.tags.length > 0 ? " " + entry.tags.map((t) => `#${t}`).join(" ") : "";

    lines.push({
      type: "entry",
      text: `${entry.timestamp} ${entry.entity} "${entry.title}"${link}${tags}`,
    });
  }

  if (results.length === 0) {
    lines.push({ type: "dim", text: "No matching entries found." });
  }

  return {
    command: `thalo query '${displayQuery}'`,
    lines,
  };
}

async function runActualize(content: PlaygroundContent): Promise<CommandResult> {
  const parser = await getParser();

  const docs = await Promise.all([
    parseDocument(parser, FILES.entities, content.entities),
    parseDocument(parser, FILES.entries, content.entries),
    parseDocument(parser, FILES.synthesis, content.synthesis),
  ]);

  // Find all synthesis entries
  const syntheses: SimpleEntry[] = [];
  for (const doc of docs) {
    for (const entry of doc.entries) {
      if (entry.type === "synthesis") {
        syntheses.push(entry);
      }
    }
  }

  const lines: TerminalLine[] = [];

  if (syntheses.length === 0) {
    lines.push({ type: "header", text: "=== Running actualize ===" });
    lines.push({ type: "blank", text: "" });
    lines.push({ type: "dim", text: "No synthesis definitions found." });
    return { command: "thalo actualize", lines };
  }

  for (const synthesis of syntheses) {
    lines.push({ type: "header", text: `=== Synthesis: ${synthesis.title} ===` });
    lines.push({ type: "info", text: `Target: ^${synthesis.linkId}` });

    if (synthesis.sources && synthesis.sources.length > 0) {
      const sourceStrs = synthesis.sources.map(formatQuery).join(", ");
      lines.push({ type: "info", text: `Sources: ${sourceStrs}` });
    }

    lines.push({ type: "blank", text: "" });

    // Show prompt
    if (synthesis.prompt) {
      lines.push({ type: "header", text: "--- User Prompt ---" });
      for (const line of synthesis.prompt.split("\n")) {
        lines.push({ type: "prompt", text: line });
      }
      lines.push({ type: "blank", text: "" });
    }

    // Find and show matching entries
    const allEntries: SimpleEntry[] = [];
    if (synthesis.sources) {
      for (const source of synthesis.sources) {
        const matches = executeQuery(docs, source);
        allEntries.push(...matches);
      }
    }

    if (allEntries.length > 0) {
      lines.push({ type: "header", text: `--- Entries (${allEntries.length}) ---` });
      lines.push({ type: "blank", text: "" });

      // Find the source for each entry and show raw text
      for (const entry of allEntries) {
        for (const doc of docs) {
          const found = doc.entries.find((e) => e === entry);
          if (found) {
            const text = doc.source.slice(entry.startIndex, entry.endIndex).trim();
            for (const line of text.split("\n")) {
              lines.push({ type: "entry", text: line });
            }
            lines.push({ type: "blank", text: "" });
            break;
          }
        }
      }
    } else {
      lines.push({ type: "dim", text: "No matching entries found." });
      lines.push({ type: "blank", text: "" });
    }

    // Instructions
    lines.push({ type: "header", text: "--- Instructions ---" });
    lines.push({ type: "dim", text: "Pipe this output to an LLM to generate the synthesis:" });
    lines.push({ type: "success", text: `  thalo actualize ^${synthesis.linkId} | llm` });
  }

  return {
    command: "thalo actualize",
    lines,
  };
}

// ===================
// Public API
// ===================

export async function runCommand(
  command: CommandType,
  content: PlaygroundContent,
  queryStr?: string,
): Promise<CommandResult> {
  switch (command) {
    case "check":
      return runCheck(content);
    case "query":
      return runQuery(content, queryStr);
    case "actualize":
      return runActualize(content);
  }
}
