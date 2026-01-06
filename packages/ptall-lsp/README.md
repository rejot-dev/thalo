# Ptall Language Server

Language Server Protocol (LSP) implementation for **ptall** (Personal Thought And Lore Language).

## Features

| Feature             | Status | Description                        |
| ------------------- | ------ | ---------------------------------- |
| Go to Definition    | ✅     | Navigate to `^link-id` definitions |
| Find All References | ✅     | Find all usages of a `^link-id`    |
| Semantic Tokens     | ✅     | Syntax highlighting via LSP        |
| Diagnostics         | ✅     | Validation errors and warnings     |
| Hover               | ✅     | Show link target details on hover  |
| Completions         | ✅     | Suggest `^link-ids` and `#tags`    |

## Architecture

The language server uses `@wilco/ptall` for parsing and semantic analysis:

```
┌─────────────────────────────────────────────────────────┐
│                      IDE / Editor                       │
│                   (VSCode, Neovim, etc.)                │
└─────────────────────────┬───────────────────────────────┘
                          │ LSP Protocol
┌─────────────────────────▼───────────────────────────────┐
│                    @wilco/ptall-lsp                     │
│  ┌────────────────────────────────────────────────────┐ │
│  │ server.ts - LSP server lifecycle & routing         │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │ handlers/ - Request handlers                       │ │
│  │   definition.ts   - Go to definition               │ │
│  │   references.ts   - Find all references            │ │
│  │   semantic-tokens.ts - Syntax highlighting         │ │
│  │   diagnostics.ts  - Validation errors              │ │
│  │   hover.ts        - Hover information              │ │
│  │   completions/    - Autocomplete suggestions       │ │
│  │     context.ts    - Context detection              │ │
│  │     providers/    - Modular completion providers   │ │
│  └────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────┐ │
│  │ capabilities.ts - LSP capability configuration     │ │
│  └────────────────────────────────────────────────────┘ │
└─────────────────────────┬───────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                      @wilco/ptall                       │
│  ┌─────────────┐ ┌─────────────┐ ┌───────────────────┐  │
│  │   parser    │ │   model     │ │     services      │  │
│  │  (parsing)  │ │ (workspace) │ │ (definition, etc) │  │
│  └─────────────┘ └─────────────┘ └───────────────────┘  │
│  ┌─────────────┐ ┌──────────────────────────────────┐   │
│  │   checker   │ │   semantic-tokens (highlighting) │   │
│  │ (diagnostics)│ └──────────────────────────────────┘  │
│  └─────────────┘                                        │
└─────────────────────────────────────────────────────────┘
```

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

The server communicates over stdio:

```bash
# Run the server (after building)
node dist/server.js --stdio
```

### Integration with Editors

The server can be integrated with any editor that supports LSP:

- **VSCode**: Use the `@wilco/ptall-vscode` extension
- **Neovim**: Configure with `nvim-lspconfig`
- **Other editors**: Configure to run `ptall-lsp --stdio`

## Feature Details

### Go to Definition

Navigate to where a `^link-id` is defined. Supports:

- Explicit link IDs: `^my-link-id`
- Timestamp links: `^2026-01-05T15:30`

### Find All References

Find all places where a link ID is used across the workspace.

### Hover

Shows entry details when hovering over:

- `^link-id` references - displays entry title, metadata, and location
- `#tags` - shows count and list of entries with that tag

### Completions

Context-aware completions throughout the entry lifecycle:

| Context         | Trigger                    | Suggests                                            |
| --------------- | -------------------------- | --------------------------------------------------- |
| Empty line      | Start typing               | Current timestamp (`2026-01-06T14:30`)              |
| After timestamp | Space                      | Directives (`create`, `update`, `define-entity`)    |
| After directive | Space                      | Entity types (`lore`, `opinion`, `reference`, etc.) |
| After title     | `^` or `#`                 | Link IDs or tags                                    |
| Metadata key    | Indented line              | Field names from entity schema                      |
| Metadata value  | After `key:`               | Valid values (literals, `^self`, etc.)              |
| Content section | `#` in content area        | Section names from schema (`Claim`, `Reasoning`)    |
| Schema block    | `#` in schema entry        | `# Metadata`, `# Sections`, etc.                    |
| Field type      | After field name in schema | `string`, `date`, `link`, `date-range`              |
| Link reference  | `^`                        | All link IDs from workspace                         |
| Tag             | `#`                        | Existing tags with usage counts                     |

**Schema-aware**: Metadata keys, values, and sections are pulled from entity schemas defined via
`define-entity`.

**Smart filtering**:

- Already-used metadata keys are excluded
- Required fields/sections sorted before optional
- Partial text filtering on all completions

### Diagnostics

Real-time validation errors using the `@wilco/ptall` checker:

- Unresolved link references
- Unknown entity types
- Missing required fields/sections
- Invalid field types
- Duplicate link IDs

### Semantic Tokens

Provides rich syntax highlighting for:

- Timestamps
- Directives (create, update, define-entity, alter-entity)
- Entity types
- Link references
- Tags
- Metadata keys and values
- Section headers
