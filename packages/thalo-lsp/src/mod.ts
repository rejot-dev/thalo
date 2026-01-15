/**
 * @rejot-dev/thalo-lsp - Language Server Protocol implementation for thalo
 *
 * This package provides an LSP server for .thalo files, enabling IDE features like:
 * - Go to Definition (^link-id → definition location)
 * - Find All References (find all usages of a ^link-id)
 * - Semantic Highlighting (syntax-aware token coloring)
 * - Diagnostics (validation errors and warnings)
 * - Hover information (show link target details)
 * - Completions (suggest ^link-ids)
 *
 * The server uses @rejot-dev/thalo for parsing and semantic analysis.
 */

export { startServer } from "./server.js";
