# @wilco/ptall

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
pnpm add @wilco/ptall
```

## Usage

### Parsing a Document

```typescript
import { Document } from "@wilco/ptall/model";

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
import { Workspace } from "@wilco/ptall/model";

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
import { Workspace } from "@wilco/ptall/model";
import { check } from "@wilco/ptall/checker";

const workspace = new Workspace();
workspace.addDocument(source, { filename: "test.ptall" });

const diagnostics = check(workspace);
for (const d of diagnostics) {
  console.log(`${d.severity}: ${d.message} (${d.code})`);
}
```

### Configuring Rule Severity

```typescript
import { check } from "@wilco/ptall/checker";

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
| `@wilco/ptall`          | Main entry (parser, constants)          |
| `@wilco/ptall/ast`      | AST types and extraction                |
| `@wilco/ptall/model`    | Document, Workspace, model types        |
| `@wilco/ptall/schema`   | SchemaRegistry, EntitySchema types      |
| `@wilco/ptall/checker`  | Validation rules and check function     |
| `@wilco/ptall/services` | Definition, references, semantic tokens |

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
├── query/
│   ├── parser.ts      # Legacy regex-based query parser (deprecated)
│   └── index.ts       # Query exports
└── services/
    ├── definition.ts  # Go-to-definition lookup
    ├── references.ts  # Find-all-references
    └── semantic-tokens.ts # LSP semantic tokens
```

## Future Work

### Grammar-Based Type System

The Tree-Sitter grammar now parses metadata values into typed AST nodes (`query_list`, `date_range`,
`value_array`, `link`, `quoted_value`, `plain_value`). This enables:

- ✅ Type validation using AST structure instead of regex
- ✅ Query parsing at the grammar level
- ✅ Proper array element validation

**Remaining work:**

1. **Remove legacy query parser** (`src/query/parser.ts`): The regex-based `parseSourcesValue` and
   `parseQuery` functions are no longer used in the main flow. The grammar now parses queries
   directly, and `document.ts` extracts them from the AST. The legacy parser is kept for backwards
   compatibility but should be removed.

2. **Remove legacy string-based type matching**: `TypeExpr.matches(raw, type)` in `schema/types.ts`
   still exists for backwards compatibility. It should be removed once all callers migrate to
   `TypeExpr.matchesContent(content, type)`.

3. **Date validation at grammar level**: Currently, single dates (e.g., `2024-05-11`) are parsed as
   `plain_value` and validated with regex at the semantic level. A future grammar enhancement could
   add a `date` token, though this conflicts with timestamp parsing.

4. **Entity-only queries**: The grammar requires `where` for query expressions. Supporting
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
