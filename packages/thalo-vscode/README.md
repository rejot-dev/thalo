# Thalo VS Code Extension

Syntax highlighting, formatting, and language server features for **Thalo** (Thought And Lore
Language) files in VS Code.

## Requirements

This extension requires the **Thalo CLI** to be installed separately for full functionality:

```bash
npm install -g @rejot-dev/thalo-cli
# or
pnpm add -g @rejot-dev/thalo-cli
```

The CLI provides:

- **Language Server** (`thalo lsp`) - Powers go-to-definition, find references, hover, completions,
  and diagnostics
- **Formatting** (`thalo format`) - Formats `.thalo` files using Prettier

Without the CLI installed, you'll still get basic syntax highlighting, but LSP features and
formatting won't work.

### Custom CLI Path

If the CLI is not in your PATH, you can configure a custom location in VS Code settings:

```json
{
  "thalo.cliPath": "/path/to/thalo"
}
```

## Features

- **Syntax highlighting** for `.thalo` files
- **Syntax highlighting** for thalo code blocks in Markdown (` ```thalo `)
- **Language Server Protocol (LSP)** features:
  - Go to Definition (navigate to entity definitions, link targets)
  - Find All References
  - Hover information
  - Completions
  - Diagnostics (errors and warnings)
  - Semantic highlighting
- **Document formatting** via Prettier
- **Comment toggling** with `//`

## Highlighted Elements

| Element          | Scope                             |
| ---------------- | --------------------------------- |
| Timestamps       | `constant.numeric.timestamp`      |
| Directives       | `keyword.control.directive`       |
| Entity types     | `entity.name.type`                |
| Titles           | `string.quoted.double.title`      |
| Links (`^ref`)   | `entity.name.tag.link`            |
| Tags (`#tag`)    | `entity.other.attribute-name.tag` |
| Metadata keys    | `variable.other.property`         |
| Primitive types  | `support.type.primitive`          |
| Markdown headers | `markup.heading`                  |
| Comments         | `comment.line.double-slash`       |

## Commands

- **Thalo: Restart Language Server** - Restart the LSP server (useful after installing/updating the
  CLI)

## Development

```bash
# Build the extension
pnpm build

# Package for distribution
pnpm package
```

## Installation

Install from the VS Code Marketplace, or for local development:

```bash
# Package and install locally
pnpm package
code --install-extension thalo-vscode-0.0.1.vsix
```
