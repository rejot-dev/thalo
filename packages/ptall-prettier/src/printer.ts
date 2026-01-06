import type { AstPath, Doc, Printer } from "prettier";
import type { SyntaxNode } from "tree-sitter";
import { doc } from "prettier";

const { hardline, join } = doc.builders;

type PtallPrinter = Printer<SyntaxNode>;

// ===================
// Instance Entry Printing (create/update lore, opinion, etc.)
// ===================

const printInstanceHeader = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [];

  for (const child of node.children) {
    if (child.type === "timestamp") {
      parts.push(child.text);
    } else if (child.type === "instance_directive") {
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

const printInstanceEntry = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [];

  const header = node.children.find((c) => c.type === "instance_header");
  if (header) {
    parts.push(printInstanceHeader(header));
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

// ===================
// Schema Entry Printing (define-entity/alter-entity)
// ===================

const printSchemaHeader = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [];

  for (const child of node.children) {
    if (child.type === "timestamp") {
      parts.push(child.text);
    } else if (child.type === "schema_directive") {
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
    const nameMatch = sectionName.text.match(/[A-Z][a-zA-Z0-9]*/);
    if (nameMatch) {
      parts.push(nameMatch[0]);
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
    const nameMatch = sectionName.text.match(/[A-Z][a-zA-Z0-9]*/);
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

const printSchemaEntry = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [];

  const header = node.children.find((c) => c.type === "schema_header");
  if (header) {
    parts.push(printSchemaHeader(header));
  }

  // Print blocks in order they appear
  for (const child of node.children) {
    if (child.type === "metadata_block") {
      parts.push(printMetadataBlock(child));
    } else if (child.type === "sections_block") {
      parts.push(printSectionsBlock(child));
    } else if (child.type === "remove_metadata_block") {
      parts.push(printRemoveMetadataBlock(child));
    } else if (child.type === "remove_sections_block") {
      parts.push(printRemoveSectionsBlock(child));
    }
  }

  return parts;
};

// ===================
// Entry Printing (dispatches to instance or schema)
// ===================

const printEntry = (node: SyntaxNode): Doc => {
  const instanceEntry = node.children.find((c) => c.type === "instance_entry");
  if (instanceEntry) {
    return printInstanceEntry(instanceEntry);
  }

  const schemaEntry = node.children.find((c) => c.type === "schema_entry");
  if (schemaEntry) {
    return printSchemaEntry(schemaEntry);
  }

  return "";
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
      case "instance_entry":
        return printInstanceEntry(node);
      case "instance_header":
        return printInstanceHeader(node);
      case "schema_entry":
        return printSchemaEntry(node);
      case "schema_header":
        return printSchemaHeader(node);
      case "metadata":
        return printMetadata(node);
      case "content":
        return printContent(node);
      case "markdown_header":
        return printMarkdownHeader(node);
      case "content_line":
        return printContentLine(node);
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
