import type { AstPath, Doc, Printer } from "prettier";
import type { SyntaxNode } from "tree-sitter";
import { doc } from "prettier";

const { hardline, join } = doc.builders;

type PtallPrinter = Printer<SyntaxNode>;

const printHeader = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [];

  for (const child of node.children) {
    if (child.type === "timestamp") {
      parts.push(child.text);
    } else if (child.type === "directive") {
      parts.push(" ", child.text);
    } else if (child.type === "entity") {
      parts.push(" ", child.text);
    } else if (child.type === "title") {
      parts.push(" ", child.text);
    } else if (child.type === "link") {
      parts.push(" ", child.text);
    } else if (child.type === "tag") {
      parts.push(" ", child.text);
    }
  }

  return parts;
};

const printMetadata = (node: SyntaxNode): Doc => {
  const key = node.childForFieldName("key");
  const value = node.childForFieldName("value");

  if (!key || !value) {
    return "";
  }

  // Trim leading/trailing whitespace from value (grammar may capture spaces)
  return ["  ", key.text, ": ", value.text.trim()];
};

const printMarkdownHeader = (node: SyntaxNode): Doc => {
  // Extract hashes and text from the node
  let hashes = "";
  let text = "";

  for (const child of node.children) {
    if (child.type === "_md_hashes") {
      hashes = child.text;
    } else if (child.type === "_md_text") {
      text = child.text;
    }
  }

  // If we couldn't get structured parts, fall back to reconstructing from text
  // Note: node.text includes trailing newline from grammar's $._eol
  if (!hashes) {
    const trimmedText = node.text.replace(/[\r\n]+$/, "");
    const match = trimmedText.match(/^\s*(#+)\s*(.*)$/);
    if (match) {
      hashes = match[1];
      text = " " + match[2];
    } else {
      return ["  ", trimmedText.trim()];
    }
  }

  return ["  ", hashes, text];
};

const printContentLine = (node: SyntaxNode): Doc => {
  // Content line text, trimmed of leading indent and trailing newline
  // (grammar includes $._eol in content_line)
  const text = node.text.replace(/^ {2}/, "").replace(/[\r\n]+$/, "");
  return ["  ", text];
};

const printContent = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [];

  // Get visible content children (markdown_header and content_line)
  const contentChildren = node.children.filter(
    (c) => c.type === "markdown_header" || c.type === "content_line",
  );

  let lastRow = -1;
  for (const child of contentChildren) {
    const currentRow = child.startPosition.row;

    if (lastRow >= 0) {
      // Check for blank lines between elements by comparing row numbers
      const rowGap = currentRow - lastRow;
      if (rowGap > 1) {
        // Add blank lines for gaps (rowGap - 1 blank lines)
        for (let i = 0; i < rowGap - 1; i++) {
          parts.push(hardline);
        }
      }
    }

    parts.push(hardline);
    if (child.type === "markdown_header") {
      parts.push(printMarkdownHeader(child));
    } else {
      parts.push(printContentLine(child));
    }

    lastRow = currentRow;
  }

  if (parts.length === 0) {
    return "";
  }

  // Blank line before content (extra hardline), then content
  return [hardline, ...parts];
};

const printEntry = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [];

  const header = node.children.find((c) => c.type === "header");
  if (header) {
    parts.push(printHeader(header));
  }

  const metadataNodes = node.children.filter((c) => c.type === "metadata");
  for (const meta of metadataNodes) {
    parts.push(hardline, printMetadata(meta));
  }

  const content = node.children.find((c) => c.type === "content");
  if (content) {
    parts.push(printContent(content));
  }

  return parts;
};

const printSourceFile = (node: SyntaxNode): Doc => {
  const entries = node.children.filter((c) => c.type === "entry");

  if (entries.length === 0) {
    return "";
  }

  // Join entries with double newlines (blank line between entries)
  const docs = entries.map((entry) => printEntry(entry));
  return [join([hardline, hardline], docs), hardline];
};

export const printer: PtallPrinter = {
  print(path: AstPath<SyntaxNode>): Doc {
    const node = path.node;

    switch (node.type) {
      case "source_file":
        return printSourceFile(node);
      case "entry":
        return printEntry(node);
      case "header":
        return printHeader(node);
      case "metadata":
        return printMetadata(node);
      case "content":
        return printContent(node);
      case "markdown_header":
        return printMarkdownHeader(node);
      case "content_line":
        return printContentLine(node);
      default:
        // For any unhandled node, just return its text
        return node.text;
    }
  },
};
