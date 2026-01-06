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

The checker includes 23 fully implemented validation rules, plus 2 placeholder rules:

### Instance Entry Rules

| Code                       | Severity | Description                                           |
| -------------------------- | -------- | ----------------------------------------------------- |
| `unknown-entity`           | error    | Instance entry uses an undefined entity type          |
| `missing-required-field`   | error    | Required metadata field not present                   |
| `unknown-field`            | warning  | Metadata field not defined in entity schema           |
| `invalid-field-type`       | error    | Metadata value doesn't match declared type            |
| `missing-required-section` | error    | Required section not present in content               |
| `unknown-section`          | warning  | Section not defined in entity schema                  |
| `missing-title`            | error    | Entry has empty or missing title                      |
| `update-without-create`    | warning  | `update` entry supersedes wrong directive/entity type |

### Link Rules

| Code                | Severity | Description                                     |
| ------------------- | -------- | ----------------------------------------------- |
| `unresolved-link`   | warning  | Link reference (`^id`) has no definition        |
| `duplicate-link-id` | error    | Same explicit `^link-id` defined multiple times |

### Schema Definition Rules

| Code                          | Severity | Description                                        |
| ----------------------------- | -------- | -------------------------------------------------- |
| `duplicate-entity-definition` | error    | Multiple `define-entity` for the same entity name  |
| `alter-undefined-entity`      | error    | `alter-entity` targets an undefined entity         |
| `alter-before-define`         | error    | `alter-entity` timestamp before `define-entity`    |
| `duplicate-field-in-schema`   | error    | Same field defined twice in a schema entry         |
| `duplicate-section-in-schema` | error    | Same section defined twice in a schema entry       |
| `remove-undefined-field`      | warning  | `# Remove Metadata` references nonexistent field   |
| `remove-undefined-section`    | warning  | `# Remove Sections` references nonexistent section |
| `invalid-default-value`       | error    | Default value doesn't match field's declared type  |

### Metadata Value Rules

| Code                       | Severity | Description                                           |
| -------------------------- | -------- | ----------------------------------------------------- |
| `empty-required-value`     | error    | Required field has empty value                        |
| `invalid-date-value`       | error    | Date doesn't match `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` |
| `invalid-date-range-value` | error    | Date range doesn't match `DATE ~ DATE` format         |

### Content Rules

| Code                        | Severity | Description                                     |
| --------------------------- | -------- | ----------------------------------------------- |
| `duplicate-section-heading` | error    | Same `# Section` appears twice in entry content |

### Placeholder Rules (Not Yet Implemented)

These rules exist but require additional infrastructure to fully implement:

| Code                     | Severity | Description                                 | Blocker                                                                                               |
| ------------------------ | -------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `duplicate-metadata-key` | error    | Same metadata key appears twice in an entry | Parser collapses duplicates into a Map before model extraction; needs AST-level or parser-level check |
| `empty-section`          | warning  | Section heading exists but has no content   | Model only stores section names, not content boundaries; needs content structure in model             |

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
