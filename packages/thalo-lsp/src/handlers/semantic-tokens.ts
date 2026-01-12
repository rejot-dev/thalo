import type { SemanticTokens } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";
import { extractSemanticTokens, encodeSemanticTokens, type FileType } from "@rejot-dev/thalo";
import { parseDocument } from "@rejot-dev/thalo/native";

/**
 * Get the file type from a URI
 */
function getFileType(uri: string): FileType {
  if (uri.endsWith(".thalo")) {
    return "thalo";
  }
  if (uri.endsWith(".md")) {
    return "markdown";
  }
  return "thalo";
}

/**
 * Handle textDocument/semanticTokens/full request
 *
 * Returns semantic tokens for syntax highlighting.
 *
 * @param document - The text document
 * @returns Semantic tokens in LSP format
 */
export function handleSemanticTokens(document: TextDocument): SemanticTokens {
  const fileType = getFileType(document.uri);

  try {
    // Parse the document
    const parsed = parseDocument(document.getText(), {
      fileType,
      filename: document.uri,
    });

    // Extract semantic tokens
    const tokens = extractSemanticTokens(parsed);

    // Encode in LSP delta format
    const data = encodeSemanticTokens(tokens);

    return { data };
  } catch (error) {
    console.error(`[thalo-lsp] Error extracting semantic tokens:`, error);
    return { data: [] };
  }
}
