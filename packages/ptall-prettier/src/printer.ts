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

const printInstanceEntry = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [];

  const header = node.children.find((c) => c.type === "instance_header");
  if (header) {
    parts.push(printInstanceHeader(header));
  }

  // Handle both metadata and comment_line nodes (they can be interleaved)
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

const printSchemaEntry = (node: SyntaxNode): Doc => {
  const parts: Doc[] = [];

  const header = node.children.find((c) => c.type === "schema_header");
  if (header) {
    parts.push(printSchemaHeader(header));
  }

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

const printTopLevelComment = (node: SyntaxNode): Doc => {
  return node.text;
};

const printSourceFile = (node: SyntaxNode): Doc => {
  // Get entries and top-level comments
  const relevantChildren = node.children.filter((c) => c.type === "entry" || c.type === "comment");

  if (relevantChildren.length === 0) {
    return "";
  }

  // Build output preserving comments and entries with proper spacing
  const docs: Doc[] = [];
  let lastWasEntry = false;

  for (const child of relevantChildren) {
    if (child.type === "comment") {
      // Add blank line before comment if previous was an entry
      if (lastWasEntry) {
        docs.push(hardline, hardline);
      } else if (docs.length > 0) {
        docs.push(hardline);
      }
      docs.push(printTopLevelComment(child));
      lastWasEntry = false;
    } else {
      // Entry - add blank line between entries/after comments
      if (docs.length > 0) {
        docs.push(hardline, hardline);
      }
      docs.push(printEntry(child));
      lastWasEntry = true;
    }
  }

  return [...docs, hardline];
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
      case "comment_line":
        return printCommentLine(node);
      case "comment":
        return printTopLevelComment(node);
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
