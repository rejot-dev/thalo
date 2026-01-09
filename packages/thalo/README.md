# @rejot-dev/thalo

Core library for **thalo** (Personal Thought And Lore Language). Provides parsing, semantic
analysis, validation, and workspace management for `.thalo` files.

## Features

- **Parser**: Parse `.thalo` files and extract thalo blocks from Markdown
- **Incremental Parsing**: Efficient incremental updates via Tree-sitter's edit API
- **Fragment Parsing**: Parse individual expressions (queries, values, type expressions)
- **AST**: Strongly-typed abstract syntax tree with inline syntax error nodes
- **Semantic Analysis**: Build semantic models with link indexes and schema resolution
- **Schema**: Entity schema registry with `define-entity` / `alter-entity` support
- **Checker**: Visitor-based validation rules with incremental checking support
- **Services**: Definition lookup, references, hover, query execution, and semantic tokens
- **Source Mapping**: Position translation for embedded blocks in Markdown files

## Installation

```bash
pnpm add @rejot-dev/thalo
```

## Usage

### Working with a Workspace

```typescript
import { Workspace } from "@rejot-dev/thalo";

const workspace = new Workspace();

// Add documents (schemas first, then instances)
workspace.addDocument(schemaSource, { filename: "entities.thalo" });
workspace.addDocument(instanceSource, { filename: "entries.thalo" });

// Access semantic models
const model = workspace.getModel("entries.thalo");
console.log(model.ast.entries); // Array of parsed entries

// Query links across workspace
const linkDef = workspace.getLinkDefinition("my-link-id");
const refs = workspace.getLinkReferences("my-link-id");
```

### Incremental Document Updates

The workspace supports efficient incremental updates:

```typescript
import { Workspace } from "@rejot-dev/thalo";

const workspace = new Workspace();
workspace.addDocument(source, { filename: "test.thalo" });

// Apply an incremental edit (more efficient than re-adding)
const invalidation = workspace.applyEdit(
  "test.thalo",
  startLine,
  startColumn,
  endLine,
  endColumn,
  newText,
);

// Check what was invalidated
if (invalidation.schemasChanged) {
  // Entity schemas changed - may affect other files
}
if (invalidation.linksChanged) {
  // Link definitions/references changed
}

// Get files affected by changes in a specific file
const affected = workspace.getAffectedFiles("test.thalo");
```

### Validating with the Checker

The checker reports both syntax errors (from AST) and semantic errors (from rules):

```typescript
import { Workspace, check } from "@rejot-dev/thalo";

const workspace = new Workspace();
workspace.addDocument(source, { filename: "test.thalo" });

const diagnostics = check(workspace);
for (const d of diagnostics) {
  // Syntax errors have codes like "syntax-missing_timezone"
  // Semantic errors have codes like "unknown-entity", "unresolved-link"
  console.log(`${d.severity}: ${d.message} (${d.code})`);
}
```

### Configuring Rule Severity

```typescript
import { check } from "@rejot-dev/thalo";

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
import { Workspace, executeQuery } from "@rejot-dev/thalo";

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

| Export                      | Description                                                |
| --------------------------- | ---------------------------------------------------------- |
| `@rejot-dev/thalo`          | Main entry (parser, workspace, checker, services, types)   |
| `@rejot-dev/thalo/ast`      | AST types, builder, visitor, extraction                    |
| `@rejot-dev/thalo/model`    | Workspace, Document, LineIndex, model types                |
| `@rejot-dev/thalo/semantic` | SemanticModel, analyzer, link index types                  |
| `@rejot-dev/thalo/schema`   | SchemaRegistry, EntitySchema types                         |
| `@rejot-dev/thalo/checker`  | Validation rules, visitor pattern, check functions         |
| `@rejot-dev/thalo/services` | Definition, references, hover, query execution, entity nav |

## Validation Rules

The checker validates documents using rules organized into categories:

- **Instance**: Validates instance entries — entity types, required fields, field types, sections
- **Link**: Validates link references and definitions — unresolved links, duplicate IDs
- **Schema**: Validates entity schema definitions — duplicates, alter/define ordering, defaults
- **Metadata**: Validates metadata values — empty values, date range formats
- **Content**: Validates entry content structure — duplicate section headings

Rules use a visitor pattern for efficient single-pass execution. Each rule declares a scope (entry,
document, or workspace) to enable incremental checking when documents change.

To see all available rules, use the CLI:

```bash
thalo rules list
```

## Architecture

The library follows a clear pipeline from source to services:

```
Source → Tree-sitter → CST → AST Builder → AST → Semantic Analyzer → SemanticModel
                        ↓                                                   ↓
                    Formatter                                           Checker
                   (CST only)                                    (syntax + semantic)
                                                                        ↓
                                                                    Services
```

### Incremental Processing

The workspace supports incremental updates at multiple levels:

1. **Document Level**: The `Document` class wraps source text with a `LineIndex` for efficient
   position lookups and tracks Tree-sitter trees per block
2. **Semantic Level**: `updateSemanticModel` incrementally updates link indexes and schema entries
3. **Workspace Level**: Dependency tracking (`linkDependencies`, `entityDependencies`) enables
   targeted invalidation
4. **Rule Level**: Rules declare their scope and dependencies, enabling incremental checking

### Error Separation

| Error Type   | Created In    | Examples                                      |
| ------------ | ------------- | --------------------------------------------- |
| **Syntax**   | AST Builder   | Missing timezone, missing entity name         |
| **Semantic** | Checker Rules | Unresolved link, unknown field, type mismatch |

Syntax errors are inline `SyntaxErrorNode` instances in the AST. Semantic errors are diagnostics
from checker rules.

### Directory Structure

```
src/
├── parser.ts          # Parse thalo source, extract from markdown
├── fragment.ts        # Parse individual expressions (query, value, type)
├── source-map.ts      # Position mapping for embedded blocks
├── constants.ts       # Language constants (directives, types)
├── ast/
│   ├── types.ts       # AST node types (Entry, Timestamp, SyntaxErrorNode, etc.)
│   ├── extract.ts     # Extract AST from tree-sitter CST
│   ├── builder.ts     # Build decomposed types (timestamps with parts)
│   ├── visitor.ts     # AST traversal utilities (walkAst, collectSyntaxErrors)
│   └── node-at-position.ts # Find semantic context at cursor position
├── semantic/
│   ├── types.ts       # SemanticModel, LinkIndex, LinkDefinition, LinkReference
│   └── analyzer.ts    # Build SemanticModel from AST (indexes links, collects schemas)
├── model/
│   ├── types.ts       # Model types (ModelSchemaEntry for SchemaRegistry)
│   ├── document.ts    # Document class with LineIndex and incremental edit support
│   ├── line-index.ts  # Fast offset↔position conversion
│   └── workspace.ts   # Multi-document workspace with dependency tracking
├── schema/
│   ├── types.ts       # Schema types (EntitySchema, FieldSchema, TypeExpr)
│   └── registry.ts    # Schema registry with define/alter resolution
├── checker/
│   ├── types.ts       # Rule, diagnostic, and dependency types
│   ├── check.ts       # Main check functions (check, checkDocument, checkIncremental)
│   ├── visitor.ts     # RuleVisitor interface and visitor execution
│   ├── workspace-index.ts # Pre-computed indices for efficient rule execution
│   └── rules/         # Individual validation rules (27 rules)
└── services/
    ├── definition.ts       # Go-to-definition lookup
    ├── references.ts       # Find-all-references
    ├── hover.ts            # Hover information (entries, types, directives)
    ├── query.ts            # Query execution engine
    ├── entity-navigation.ts # Entity/tag/field/section navigation
    └── semantic-tokens.ts   # LSP semantic tokens
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

## Future Work

### Grammar-Based Type System

The Tree-Sitter grammar parses all values into typed AST nodes:

- ✅ Type validation using AST structure (no regex parsing)
- ✅ Query parsing at the grammar level
- ✅ Proper array element validation
- ✅ Typed default values (`quoted_value`, `link`, `datetime_value`)
- ✅ Query execution engine for synthesis entries
- ✅ Decomposed timestamps with date/time/timezone parts
- ✅ Inline syntax error nodes for recoverable parse errors
- ✅ Incremental parsing and semantic analysis
- ✅ Visitor-based rule system with dependency declarations

**Remaining work:**

1. **Entity-only queries**: The grammar requires `where` for query expressions. Supporting
   entity-only queries (e.g., `sources: lore`) would require grammar changes to avoid ambiguity.

### Semantic Analysis

1. **Cross-file link resolution**: Currently, link references are validated within the workspace.
   Future work could include import/export semantics for external references.

### Validation Rules

1. **Cyclic reference detection**: Links can form cycles; detection would prevent infinite loops.

2. **Schema evolution validation**: `alter-entity` changes could be validated for backwards
   compatibility.

3. **Content structure validation**: Validate that content sections match the schema's section
   definitions.
