# @rejot-dev/ptall

Core library for **ptall** (Personal Thought And Lore Language). Provides parsing, semantic
analysis, validation, and workspace management for `.ptall` files.

## Features

- **Parser**: Parse `.ptall` files and extract ptall blocks from Markdown
- **AST**: Strongly-typed abstract syntax tree for ptall entries
- **Model**: Document and workspace management with link indexing
- **Schema**: Entity schema registry with `define-entity` / `alter-entity` support
- **Checker**: Configurable validation rules with error/warning severity
- **Services**: Definition lookup, references, and semantic tokens

## Installation

```bash
pnpm add @rejot-dev/ptall
```

## Usage

### Parsing a Document

```typescript
import { Document } from "@rejot-dev/ptall/model";

const source = `
2026-01-05T15:30 create lore "My first entry" #example
  type: fact
  subject: ^self

  Some content here.
`;

const doc = Document.parse(source, { filename: "example.ptall" });
console.log(doc.entries); // Array of parsed entries
```

### Working with a Workspace

```typescript
import { Workspace } from "@rejot-dev/ptall/model";

const workspace = new Workspace();

// Add documents (schemas first, then instances)
workspace.addDocument(schemaSource, { filename: "entities.ptall" });
workspace.addDocument(instanceSource, { filename: "entries.ptall" });

// Query the workspace
const entry = workspace.findEntry("2026-01-05T15:30");
const linkDef = workspace.getLinkDefinition("my-link-id");
```

### Validating with the Checker

```typescript
import { Workspace } from "@rejot-dev/ptall/model";
import { check } from "@rejot-dev/ptall/checker";

const workspace = new Workspace();
workspace.addDocument(source, { filename: "test.ptall" });

const diagnostics = check(workspace);
for (const d of diagnostics) {
  console.log(`${d.severity}: ${d.message} (${d.code})`);
}
```

### Configuring Rule Severity

```typescript
import { check } from "@rejot-dev/ptall/checker";

const diagnostics = check(workspace, {
  rules: {
    "unknown-field": "off", // Disable this rule
    "unresolved-link": "error", // Upgrade to error
  },
});
```

## Module Exports

| Export                  | Description                             |
| ----------------------- | --------------------------------------- |
| `@rejot-dev/ptall`          | Main entry (parser, constants)          |
| `@rejot-dev/ptall/ast`      | AST types and extraction                |
| `@rejot-dev/ptall/model`    | Document, Workspace, model types        |
| `@rejot-dev/ptall/schema`   | SchemaRegistry, EntitySchema types      |
| `@rejot-dev/ptall/checker`  | Validation rules and check function     |
| `@rejot-dev/ptall/services` | Definition, references, semantic tokens |

## Validation Rules

The checker includes 25 validation rules across 5 categories: instance entry, link, schema
definition, metadata value, and content rules.

To see all available rules with descriptions, use the CLI:

```bash
ptall rules list
```

Filter by severity or category:

```bash
ptall rules list --severity error
ptall rules list --category schema
```

Or get JSON output:

```bash
ptall rules list --json
```

## Development

```bash
# Build
pnpm build

# Type check
pnpm types:check

# Run tests
pnpm test

# Watch mode
pnpm test:watch
```

## Architecture

```
src/
├── parser.ts          # Parse ptall source, extract from markdown
├── constants.ts       # Language constants (directives, types)
├── ast/
│   ├── types.ts       # AST node types
│   └── extract.ts     # Extract AST from tree-sitter
├── model/
│   ├── types.ts       # Model types (entries, links)
│   ├── document.ts    # Single document representation
│   └── workspace.ts   # Multi-document workspace
├── schema/
│   ├── types.ts       # Schema types (EntitySchema, FieldSchema)
│   └── registry.ts    # Schema registry with alter support
├── checker/
│   ├── types.ts       # Rule and diagnostic types
│   ├── check.ts       # Main check function
│   └── rules/         # Individual validation rules
└── services/
    ├── definition.ts  # Go-to-definition lookup
    ├── references.ts  # Find-all-references
    └── semantic-tokens.ts # LSP semantic tokens
```

## Future Work

### Grammar-Based Type System

The Tree-Sitter grammar parses all values into typed AST nodes:

- ✅ Type validation using AST structure (no regex parsing)
- ✅ Query parsing at the grammar level
- ✅ Proper array element validation
- ✅ Typed default values (`quoted_value`, `link`, `datetime_value`)

**Remaining work:**

1. **Entity-only queries**: The grammar requires `where` for query expressions. Supporting
   entity-only queries (e.g., `sources: lore`) would require grammar changes to avoid ambiguity with
   plain values.

### Semantic Analysis

1. **Cross-file link resolution**: Currently, link references are validated within the workspace.
   Future work could include import/export semantics for external references.

2. **Query execution**: The grammar parses query syntax, but there's no query execution engine yet.
   Queries are currently only used for synthesis entries.

3. **Incremental parsing**: Large workspaces could benefit from incremental document updates instead
   of full re-parsing.

### Validation Rules

1. **Cyclic reference detection**: Links can form cycles; detection would prevent infinite loops in
   processing.

2. **Schema evolution validation**: `alter-entity` changes could be validated for backwards
   compatibility.

3. **Content structure validation**: Validate that content sections match the schema's section
   definitions.
