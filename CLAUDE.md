# CLAUDE.md

## Overview

Thalo (Thought And Lore Language) is a structured language for capturing personal knowledge,
thoughts, and references. This monorepo contains the parser, tooling, and editor integrations.

## Setup

```bash
CXXFLAGS="-std=c++20" pnpm install
pnpm build
```

## Common Commands

(In the root of the project, so we get caching:)

- `pnpm exec turbo run types:check build test`
  - (types:check, build, test are individual tasks)

After changing the grammar, run:

```bash
node scripts/check-rebuild.mjs --fix
```

## Package Structure

### `packages/`

| Package                                        | Description                                         |
| ---------------------------------------------- | --------------------------------------------------- |
| `grammar` (`@rejot-dev/tree-sitter-thalo`)     | Tree-sitter grammar definition                      |
| `thalo` (`@rejot-dev/thalo`)                   | Core library: AST, model, schema, checker, services |
| `thalo-lsp` (`@rejot-dev/thalo-lsp`)           | Language Server Protocol implementation             |
| `thalo-prettier` (`@rejot-dev/thalo-prettier`) | Prettier plugin for `.thalo` files                  |
| `thalo-vscode` (`@rejot-dev/thalo-vscode`)     | VSCode extension (syntax + LSP client)              |
| `scripts`                                      | Shared build utilities                              |
| `typescript-config`                            | Shared tsconfig                                     |

### `apps/`

| App         | Description                                               |
| ----------- | --------------------------------------------------------- |
| `thalo-cli` | CLI tool (`init`, `check`, `actualize`, `rules` commands) |
| `docs`      | Documentation site (React Router + Fumadocs + Cloudflare) |

## Tech Stack

- pnpm workspaces + Turborepo
- Tree-sitter for parsing (requires C++20 for Node 24)
- tsdown for TypeScript bundling
- Vitest
- Lefthook
- Prettier
- Oxlint
