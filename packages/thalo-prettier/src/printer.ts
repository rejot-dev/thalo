import type { AstPath, Doc, Printer } from "prettier";
import type { SyntaxNode } from "tree-sitter";
import { doc } from "prettier";
import type { ThaloRootNode } from "./parser";
import { findErrorNodes, formatParseErrors } from "./parse-errors";

const { hardline, join } = doc.builders;

type ThaloPrinter = Printer<SyntaxNode>;

// Track if we've already warned for this format run to avoid duplicate warnings
let hasWarnedThisRun = false;

/**
 * Emit a warning about parse errors in the source.
 * Called once per format run when ERROR nodes are present.
 */
function emitParseWarning(rootNode: ThaloRootNode): void {
  if (hasWarnedThisRun) {
    return;
  }
  hasWarnedThisRun = true;

  const source = rootNode._thaloSource;
  if (!source) {
    return;
  }

  const errorNodes = findErrorNodes(rootNode);
  if (errorNodes.length === 0) {
    return;
  }

  const filepath = rootNode._thaloFilepath ?? "<unknown>";
  const message = formatParseErrors(source, errorNodes, filepath);
  console.warn(
    `\n[thalo-prettier] Warning: File contains syntax errors. Returning original source unchanged.\n${message}\n`,
  );
}

/**
 * Reset warning state. Called at start of each source_file print.
 */
function resetWarningState(): void {
  hasWarnedThisRun = false;
}

// ===================
// Instance Entry Printing (create/update lore, opinion, etc.)
// ===================

/**
 * Print header fields that are inline in data_entry or schema_entry nodes.
 * The new grammar has header fields directly on the entry node rather than
 * in a separate header child node.
 */
const printEntryHeaderFields = (
  node: SyntaxNode,
  directiveType: "data_directive" | "schema_directive",
): Doc => {
  const parts: Doc[] = [];

  for (const child of node.children) {
    if (child.type === "timestamp") {
      parts.push(child.text);
    } else if (child.type === directiveType) {
      parts.push(" ", child.text);
    } else if (child.type === "identifier") {
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
  // Extract hashes and text from the node (new grammar uses md_indicator and md_heading_text)
  let hashes = "";
  let text = "";

  for (const child of node.children) {
    if (child.type === "md_indicator") {
      hashes = child.text;
    } else if (child.type === "md_heading_text") {
      text = child.text;
    }
  }

  // If we couldn't get structured parts, fall back to reconstructing from text
  // Note: node.text includes preceding newline from grammar's _content_line_start
  if (!hashes) {
    const trimmedText = node.text.replace(/^[\r\n\s]+/, "").replace(/[\r\n]+$/, "");
    const match = trimmedText.match(/^(#+)\s*(.*)$/);
    if (match) {
      hashes = match[1];
      text = " " + match[2];
    } else {
      return ["  ", trimmedText.trim()];
    }
  }

  // Normalize multiple spaces to single space in header text
  text = text.replace(/ +/g, " ");

  return ["  ", hashes, text];
};

const printContentLine = (node: SyntaxNode): Doc => {
  // New grammar: content_line has content_text child
  const contentText = node.children.find((c) => c.type === "content_text");
  if (contentText) {
    return ["  ", contentText.text.trim()];
  }

  // Fallback: Content line text, trimmed of leading newline/indent and trailing newline
  // (grammar includes _content_line_start which has the newline+indent)
  const text = node.text.replace(/^[\r\n\s]+/, "").replace(/[\r\n]+$/, "");
  return ["  ", text];
};

const printCommentLine = (node: SyntaxNode): Doc => {
  // comment_line contains a comment child
  const comment = node.children.find((c) => c.type === "comment");
  if (comment) {
    return ["  ", comment.text];
  }
  // Fallback: extract comment from node text
  const text = node.text.replace(/^[\r\n\s]+/, "").replace(/[\r\n]+$/, "");
  return ["  ", text];
};

const printContent = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [];

  // Get visible content children (markdown_header, content_line, and comment_line)
  const contentChildren = node.children.filter(
    (c) => c.type === "markdown_header" || c.type === "content_line" || c.type === "comment_line",
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
    } else if (child.type === "comment_line") {
      parts.push(printCommentLine(child));
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

/**
 * Print a data_entry node (handles create, update, define-synthesis, actualize-synthesis).
 * Header fields are inline on the entry node in the new grammar.
 */
const printDataEntry = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [];

  // Print header fields directly from the entry node
  parts.push(printEntryHeaderFields(node, "data_directive"));

  // Handle metadata and comment_line nodes (they can be interleaved)
  const metadataAndComments = node.children.filter(
    (c) => c.type === "metadata" || c.type === "comment_line",
  );
  for (const child of metadataAndComments) {
    if (child.type === "metadata") {
      parts.push(hardline, printMetadata(child));
    } else {
      parts.push(hardline, printCommentLine(child));
    }
  }

  const content = node.children.find((c) => c.type === "content");
  if (content) {
    parts.push(printContent(content));
  }

  return parts;
};

// ===================
// Schema Entry Printing (define-entity/alter-entity)
// ===================

const printTypeExpression = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [];

  for (const child of node.children) {
    if (child.type === "union_type") {
      parts.push(printUnionType(child));
    } else if (child.type === "array_type") {
      parts.push(printArrayType(child));
    } else if (child.type === "primitive_type") {
      parts.push(child.text);
    } else if (child.type === "literal_type") {
      parts.push(child.text);
    }
  }

  return parts;
};

const printUnionType = (node: SyntaxNode): Doc => {
  const typeTerms: Doc[] = [];

  for (const child of node.children) {
    if (child.type === "array_type") {
      typeTerms.push(printArrayType(child));
    } else if (child.type === "primitive_type" || child.type === "literal_type") {
      typeTerms.push(child.text);
    }
  }

  return join(" | ", typeTerms);
};

const printArrayType = (node: SyntaxNode): Doc => {
  for (const child of node.children) {
    if (child.type === "primitive_type" || child.type === "literal_type") {
      return [child.text, "[]"];
    }
  }
  return node.text;
};

const printFieldDefinition = (node: SyntaxNode): Doc => {
  const parts: Doc[] = ["  "];

  // Field name (includes newline+indent in token, extract just the name)
  const fieldName = node.children.find((c) => c.type === "field_name");
  if (fieldName) {
    // Extract just the field name from the token (which includes \n and indent)
    const nameMatch = fieldName.text.match(/[a-z][a-zA-Z0-9\-_]*/);
    if (nameMatch) {
      parts.push(nameMatch[0]);
    }
  }

  // Optional marker
  const optionalMarker = node.children.find((c) => c.type === "optional_marker");
  if (optionalMarker) {
    parts.push("?");
  }

  parts.push(": ");

  // Type expression
  const typeExpr = node.childForFieldName("type");
  if (typeExpr) {
    parts.push(printTypeExpression(typeExpr));
  }

  // Default value
  const defaultValue = node.childForFieldName("default");
  if (defaultValue) {
    parts.push(" = ");
    const literal = defaultValue.children.find((c) => c.type === "literal_type");
    if (literal) {
      parts.push(literal.text.trim());
    } else {
      parts.push(defaultValue.text.trim());
    }
  }

  // Description
  const description = node.childForFieldName("description");
  if (description) {
    parts.push(" ; ", description.text);
  }

  return parts;
};

const printSectionDefinition = (node: SyntaxNode): Doc => {
  const parts: Doc[] = ["  "];

  // Section name (includes newline+indent in token, extract just the name)
  const sectionName = node.children.find((c) => c.type === "section_name");
  if (sectionName) {
    // Extract just the section name from the token (which includes \n and indent)
    // Section names can have spaces: "Key Takeaways", "Related Items", etc.
    // Match allows 1+ spaces between words, then normalize to single space
    const nameMatch = sectionName.text.match(/[A-Z][a-zA-Z0-9]*(?: +[a-zA-Z0-9]+)*/);
    if (nameMatch) {
      // Normalize multiple spaces to single space
      parts.push(nameMatch[0].replace(/ +/g, " "));
    }
  }

  // Optional marker
  const optionalMarker = node.children.find((c) => c.type === "optional_marker");
  if (optionalMarker) {
    parts.push("?");
  }

  // Description
  const description = node.childForFieldName("description");
  if (description) {
    parts.push(" ; ", description.text);
  }

  return parts;
};

const printFieldRemoval = (node: SyntaxNode): Doc => {
  const parts: Doc[] = ["  "];

  // Field name
  const fieldName = node.children.find((c) => c.type === "field_name");
  if (fieldName) {
    const nameMatch = fieldName.text.match(/[a-z][a-zA-Z0-9\-_]*/);
    if (nameMatch) {
      parts.push(nameMatch[0]);
    }
  }

  // Reason (description)
  const reason = node.childForFieldName("reason");
  if (reason) {
    parts.push(" ; ", reason.text);
  }

  return parts;
};

const printSectionRemoval = (node: SyntaxNode): Doc => {
  const parts: Doc[] = ["  "];

  // Section name
  const sectionName = node.children.find((c) => c.type === "section_name");
  if (sectionName) {
    // Section names can have spaces: "Key Takeaways", "Related Items", etc.
    // Match allows 1+ spaces between words, then normalize to single space
    const nameMatch = sectionName.text.match(/[A-Z][a-zA-Z0-9]*(?: +[a-zA-Z0-9]+)*/);
    if (nameMatch) {
      // Normalize multiple spaces to single space
      parts.push(nameMatch[0].replace(/ +/g, " "));
    }
  }

  // Reason (description)
  const reason = node.childForFieldName("reason");
  if (reason) {
    parts.push(" ; ", reason.text);
  }

  return parts;
};

const printMetadataBlock = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [hardline, "  # Metadata"];

  const fieldDefs = node.children.filter((c) => c.type === "field_definition");
  for (const field of fieldDefs) {
    parts.push(hardline, printFieldDefinition(field));
  }

  return parts;
};

const printSectionsBlock = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [hardline, "  # Sections"];

  const sectionDefs = node.children.filter((c) => c.type === "section_definition");
  for (const section of sectionDefs) {
    parts.push(hardline, printSectionDefinition(section));
  }

  return parts;
};

const printRemoveMetadataBlock = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [hardline, "  # Remove Metadata"];

  const fieldRemovals = node.children.filter((c) => c.type === "field_removal");
  for (const removal of fieldRemovals) {
    parts.push(hardline, printFieldRemoval(removal));
  }

  return parts;
};

const printRemoveSectionsBlock = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [hardline, "  # Remove Sections"];

  const sectionRemovals = node.children.filter((c) => c.type === "section_removal");
  for (const removal of sectionRemovals) {
    parts.push(hardline, printSectionRemoval(removal));
  }

  return parts;
};

/**
 * Print a schema_entry node (handles define-entity, alter-entity).
 * Header fields are inline on the entry node in the new grammar.
 */
const printSchemaEntry = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [];

  // Print header fields directly from the entry node
  parts.push(printEntryHeaderFields(node, "schema_directive"));

  // Track whether we've printed a block (for adding blank lines between blocks)
  let hasBlockBefore = false;

  // Print blocks in order they appear
  for (const child of node.children) {
    if (child.type === "metadata_block") {
      parts.push(printMetadataBlock(child));
      hasBlockBefore = true;
    } else if (child.type === "sections_block") {
      // Add blank line before # Sections if there's a preceding block
      if (hasBlockBefore) {
        parts.push(hardline);
      }
      parts.push(printSectionsBlock(child));
      hasBlockBefore = true;
    } else if (child.type === "remove_metadata_block") {
      parts.push(printRemoveMetadataBlock(child));
      hasBlockBefore = true;
    } else if (child.type === "remove_sections_block") {
      // Add blank line before # Remove Sections if there's a preceding block
      if (hasBlockBefore) {
        parts.push(hardline);
      }
      parts.push(printRemoveSectionsBlock(child));
      hasBlockBefore = true;
    }
  }

  return parts;
};

// ===================
// Entry Printing (dispatches to instance or schema)
// ===================

const printEntry = (node: SyntaxNode): Doc => {
  const dataEntry = node.children.find((c) => c.type === "data_entry");
  if (dataEntry) {
    return printDataEntry(dataEntry);
  }

  const schemaEntry = node.children.find((c) => c.type === "schema_entry");
  if (schemaEntry) {
    return printSchemaEntry(schemaEntry);
  }

  // For unhandled entry types, preserve the original text
  return node.text;
};

const printComment = (node: SyntaxNode): Doc => {
  // Use column position to determine if comment was indented
  const isIndented = node.startPosition.column > 0;
  return isIndented ? ["  ", node.text] : node.text;
};

const printUnhandledNode = (node: SyntaxNode): Doc => {
  // Preserve unhandled nodes exactly as they appear in source
  return node.text;
};

const printSourceFile = (node: SyntaxNode): Doc => {
  // Reset warning state for this format run
  resetWarningState();

  // Check for errors - if present, return original source unchanged
  // Tree-sitter error recovery can produce structurally broken trees where
  // content gets detached from its parent entry, losing indentation context.
  // Safest approach: don't format files with syntax errors.
  const rootNode = node as ThaloRootNode;
  if (rootNode._thaloHasErrors) {
    emitParseWarning(rootNode);
    // Return original source unchanged (with trailing newline for consistency)
    const source = rootNode._thaloSource ?? "";
    return source.endsWith("\n") ? source : source + "\n";
  }

  // Get all non-whitespace children
  const relevantChildren = node.children.filter((c) => c.type !== "");

  if (relevantChildren.length === 0) {
    return "";
  }

  // Build output preserving comments and entries with proper spacing
  const docs: Doc[] = [];
  let lastWasEntry = false;
  let lastWasIndentedComment = false;

  for (const child of relevantChildren) {
    if (child.type === "comment") {
      const isIndented = child.startPosition.column > 0;

      if (isIndented) {
        // Indented comment - belongs to preceding entry, no blank line
        docs.push(hardline, printComment(child));
        lastWasIndentedComment = true;
      } else {
        // Top-level comment - add blank line after entry
        if (lastWasEntry || lastWasIndentedComment) {
          docs.push(hardline, hardline);
        } else if (docs.length > 0) {
          docs.push(hardline);
        }
        docs.push(printComment(child));
        lastWasIndentedComment = false;
      }
      lastWasEntry = false;
    } else if (child.type === "entry") {
      // Entry - add blank line between entries/after comments
      if (docs.length > 0) {
        docs.push(hardline, hardline);
      }
      docs.push(printEntry(child));
      lastWasEntry = true;
      lastWasIndentedComment = false;
    } else {
      // Unhandled node type - preserve as-is with proper spacing
      if (docs.length > 0) {
        docs.push(hardline, hardline);
      }
      docs.push(printUnhandledNode(child));
      lastWasEntry = true; // Treat as entry for spacing purposes
      lastWasIndentedComment = false;
    }
  }

  return [...docs, hardline];
};

export const printer: ThaloPrinter = {
  print(path: AstPath<SyntaxNode>): Doc {
    const node = path.node;

    switch (node.type) {
      case "source_file":
        return printSourceFile(node);
      case "entry":
        return printEntry(node);
      case "data_entry":
        return printDataEntry(node);
      case "schema_entry":
        return printSchemaEntry(node);
      case "metadata":
        return printMetadata(node);
      case "content":
        return printContent(node);
      case "markdown_header":
        return printMarkdownHeader(node);
      case "content_line":
        return printContentLine(node);
      case "comment_line":
        return printCommentLine(node);
      case "comment":
        return printComment(node);
      case "metadata_block":
        return printMetadataBlock(node);
      case "sections_block":
        return printSectionsBlock(node);
      case "remove_metadata_block":
        return printRemoveMetadataBlock(node);
      case "remove_sections_block":
        return printRemoveSectionsBlock(node);
      case "field_definition":
        return printFieldDefinition(node);
      case "section_definition":
        return printSectionDefinition(node);
      case "field_removal":
        return printFieldRemoval(node);
      case "section_removal":
        return printSectionRemoval(node);
      case "type_expression":
        return printTypeExpression(node);
      case "union_type":
        return printUnionType(node);
      case "array_type":
        return printArrayType(node);
      default:
        // For any unhandled node, just return its text
        return node.text;
    }
  },
};
