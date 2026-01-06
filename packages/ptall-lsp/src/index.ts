/**
 * @wilco/ptall-lsp - Language Server Protocol implementation for ptall
 *
 * This package provides an LSP server for .ptall files, enabling IDE features like:
 * - Go to Definition (^link-id → definition location)
 * - Find All References (find all usages of a ^link-id)
 * - Semantic Highlighting (syntax-aware token coloring)
 * - Diagnostics (validation errors and warnings) [planned]
 * - Hover information (show link target details) [planned]
 * - Completions (suggest ^link-ids) [planned]
 *
 * The server uses @wilco/ptall for parsing and semantic analysis.
 */

export { createConnection, startServer, tokenLegend } from "./server.js";
export { serverCapabilities } from "./capabilities.js";
export * from "./handlers/index.js";
