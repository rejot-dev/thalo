# @rejot-dev/thalo

Core library for **thalo** (Personal Thought And Lore Language). Provides parsing, semantic
analysis, validation, and workspace management for `.thalo` files.

## Features

- **Parser**: Parse `.thalo` files and extract thalo blocks from Markdown
- **Fragment Parsing**: Parse individual expressions (queries, values, type expressions)
- **AST**: Strongly-typed abstract syntax tree for thalo entries
- **Model**: Document and workspace management with link indexing
- **Schema**: Entity schema registry with `define-entity` / `alter-entity` support
- **Checker**: Configurable validation rules with error/warning severity
- **Services**: Definition lookup, references, hover, query execution, and semantic tokens
- **Source Mapping**: Position translation for embedded blocks in Markdown files

## Installation

```bash
pnpm add @rejot-dev/thalo
```

## Usage

### Parsing a Document

```typescript
import { Document } from "@rejot-dev/thalo/model";

const source = `
2026-01-05T15:30 create lore "My first entry" #example
  type: fact
  subject: ^self

  Some content here.
`;

const doc = Document.parse(source, { filename: "example.thalo" });
console.log(doc.entries); // Array of parsed entries
```

### Working with a Workspace

```typescript
import { Workspace } from "@rejot-dev/thalo/model";

const workspace = new Workspace();

// Add documents (schemas first, then instances)
workspace.addDocument(schemaSource, { filename: "entities.thalo" });
workspace.addDocument(instanceSource, { filename: "entries.thalo" });

// Query the workspace
const entry = workspace.findEntry("2026-01-05T15:30");
const linkDef = workspace.getLinkDefinition("my-link-id");
```

### Validating with the Checker

```typescript
import { Workspace } from "@rejot-dev/thalo/model";
import { check } from "@rejot-dev/thalo/checker";

const workspace = new Workspace();
workspace.addDocument(source, { filename: "test.thalo" });

const diagnostics = check(workspace);
for (const d of diagnostics) {
  console.log(`${d.severity}: ${d.message} (${d.code})`);
}
```

### Configuring Rule Severity

```typescript
import { check } from "@rejot-dev/thalo/checker";

const diagnostics = check(workspace, {
  rules: {
    "unknown-field": "off", // Disable this rule
    "unresolved-link": "error", // Upgrade to error
  },
});
```

### Parsing Fragments

Parse individual expressions without a full document context:

```typescript
import { parseFragment, parseQuery } from "@rejot-dev/thalo";

// Parse a query expression
const queryResult = parseQuery("lore where subject = ^self and #career");
if (queryResult.valid) {
  console.log(queryResult.node.type); // "query"
}

// Parse a type expression
const typeResult = parseFragment("type_expression", 'string | "literal"');
```

### Executing Queries

Query entries in a workspace based on synthesis source definitions:

```typescript
import { Workspace } from "@rejot-dev/thalo/model";
import { executeQuery } from "@rejot-dev/thalo/services";

const workspace = new Workspace();
// ... add documents ...

const results = executeQuery(workspace, {
  entity: "lore",
  conditions: [
    { kind: "field", field: "subject", value: "^self" },
    { kind: "tag", tag: "career" },
  ],
});
```

### Source Mapping for Embedded Blocks

Handle positions in markdown files with embedded thalo blocks:

```typescript
import { parseDocument, findBlockAtPosition, toFileLocation } from "@rejot-dev/thalo";

const parsed = parseDocument(markdownSource, { filename: "notes.md" });

// Find which block contains a file position
const match = findBlockAtPosition(parsed.blocks, { line: 10, column: 5 });
if (match) {
  // Convert block-relative location to file-absolute
  const fileLocation = toFileLocation(match.block.sourceMap, entryLocation);
}
```

## Module Exports

| Export                      | Description                                                                    |
| --------------------------- | ------------------------------------------------------------------------------ |
| `@rejot-dev/thalo`          | Main entry (parser, fragment parsing, source mapping, checker, services, etc.) |
| `@rejot-dev/thalo/ast`      | AST types and extraction                                                       |
| `@rejot-dev/thalo/model`    | Document, Workspace, model types                                               |
| `@rejot-dev/thalo/schema`   | SchemaRegistry, EntitySchema types                                             |
| `@rejot-dev/thalo/checker`  | Validation rules and check function                                            |
| `@rejot-dev/thalo/services` | Definition, references, hover, query execution, entity navigation              |

## Validation Rules

The checker includes 30 validation rules across 6 categories: instance entry, link, schema
definition, metadata value, content, and synthesis rules.

To see all available rules with descriptions, use the CLI:

```bash
thalo rules list
```

Filter by severity or category:

```bash
thalo rules list --severity error
thalo rules list --category schema
```

Or get JSON output:

```bash
thalo rules list --json
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
├── parser.ts          # Parse thalo source, extract from markdown
├── fragment.ts        # Parse individual expressions (query, value, type)
├── source-map.ts      # Position mapping for embedded blocks
├── constants.ts       # Language constants (directives, types)
├── ast/
│   ├── types.ts       # AST node types
│   ├── extract.ts     # Extract AST from tree-sitter
│   └── node-at-position.ts # Find semantic context at position
├── model/
│   ├── types.ts       # Model types (entries, links, queries)
│   ├── document.ts    # Single document representation
│   └── workspace.ts   # Multi-document workspace
├── schema/
│   ├── types.ts       # Schema types (EntitySchema, FieldSchema)
│   └── registry.ts    # Schema registry with alter support
├── checker/
│   ├── types.ts       # Rule and diagnostic types
│   ├── check.ts       # Main check function
│   └── rules/         # Individual validation rules (30 rules)
└── services/
    ├── definition.ts       # Go-to-definition lookup
    ├── references.ts       # Find-all-references
    ├── hover.ts            # Hover information (entries, types, directives)
    ├── query.ts            # Query execution engine
    ├── entity-navigation.ts # Entity/tag/field/section navigation
    └── semantic-tokens.ts   # LSP semantic tokens
```

## Future Work

### Grammar-Based Type System

The Tree-Sitter grammar parses all values into typed AST nodes:

- ✅ Type validation using AST structure (no regex parsing)
- ✅ Query parsing at the grammar level
- ✅ Proper array element validation
- ✅ Typed default values (`quoted_value`, `link`, `datetime_value`)
- ✅ Query execution engine for synthesis entries

**Remaining work:**

1. **Entity-only queries**: The grammar requires `where` for query expressions. Supporting
   entity-only queries (e.g., `sources: lore`) would require grammar changes to avoid ambiguity with
   plain values.

### Semantic Analysis

1. **Cross-file link resolution**: Currently, link references are validated within the workspace.
   Future work could include import/export semantics for external references.

2. **Incremental parsing**: Large workspaces could benefit from incremental document updates instead
   of full re-parsing.

### Validation Rules

1. **Cyclic reference detection**: Links can form cycles; detection would prevent infinite loops in
   processing.

2. **Schema evolution validation**: `alter-entity` changes could be validated for backwards
   compatibility.

3. **Content structure validation**: Validate that content sections match the schema's section
   definitions.
