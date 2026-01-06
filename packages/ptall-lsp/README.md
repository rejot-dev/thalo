# Ptall Language Server

Language Server Protocol (LSP) implementation for **ptall** (Personal Thought And Lore Language).

## Features

| Feature             | Status | Description                        |
| ------------------- | ------ | ---------------------------------- |
| Go to Definition    | 🚧     | Navigate to `^link-id` definitions |
| Find All References | 🚧     | Find all usages of a `^link-id`    |
| Diagnostics         | 📋     | Validation errors and warnings     |
| Hover               | 📋     | Show link target details on hover  |
| Completions         | 📋     | Suggest `^link-ids` from workspace |

**Legend:** ✅ Implemented | 🚧 Outlined | 📋 Planned

## Architecture

The language server uses `@wilco/ptall` for parsing and semantic analysis:

```
┌─────────────────────────────────────────────────────────┐
│                     LSP Client (VS Code)                │
└─────────────────────────┬───────────────────────────────┘
                          │ JSON-RPC
┌─────────────────────────▼───────────────────────────────┐
│                   @wilco/ptall-lsp                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   server.ts  │  │ capabilities │  │   handlers/  │   │
│  │  (lifecycle) │  │    (config)  │  │ (def, refs)  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                     @wilco/ptall                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │    parser    │  │    model/    │  │   services/  │   │
│  │              │  │  (Workspace) │  │ (def, refs)  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Implementation Status

The handlers are currently outlines. To complete the implementation:

1. **Position conversion** - LSP uses line/character, ptall uses offsets
2. **Workspace management** - Track open documents in a `Workspace` instance
3. **Result conversion** - Convert ptall `Location` to LSP `Location`

See `src/handlers/definition.ts` and `src/handlers/references.ts` for detailed notes.

## Development

```bash
# Build
pnpm build

# Type check
pnpm types:check

# Run tests
pnpm test
```

## Usage

The server communicates over stdio by default:

```bash
node dist/server.js --stdio
```

For VS Code integration, see `@wilco/ptall-vscode`.
