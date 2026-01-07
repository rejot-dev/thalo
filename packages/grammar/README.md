# @wilco/grammar

A Tree-Sitter grammar for parsing **ptall** (Personal Thought And Lore Language) entries used in the
Knowledge Center.

## Overview

Ptall is a Beancount-inspired syntax for recording structured knowledge entries including lore,
opinions, references, and journal entries. It also supports a meta-layer for defining entity
schemas.

## Markdown Integration

Ptall is designed to coexist with markdown. You can embed ptall code blocks inside markdown files
using fenced code blocks with the `ptall` language identifier:

````markdown
# My Document

Some markdown content here.

```ptall
2026-01-05T18:00 create lore "An insight" #example
  type: insight
  subject: ^self

  This ptall entry lives inside a markdown file.
```

More markdown content.
````

When using the `@wilco/ptall-prettier` plugin, Prettier automatically formats ptall code blocks
embedded in markdown files. This enables documentation files to include properly formatted ptall
examples.

## Instance Entries

Create or update instances of entities (lore, opinion, reference, journal):

```
{timestamp} {directive} {entity} "Title" [^link-id] [#tags...]
  {key}: {value}
  ...

  {content}
```

### Example

```ptall
2026-01-05T18:11 create lore "Custom event streaming system" ^event-streaming #architecture #distributed
  type: fact
  subject: acme-corp
  date: 2018 ~ 2022

  The company built a custom event streaming system on top of Postgres
  before Kafka became widely adopted.
```

### Header Line

| Element   | Pattern                                   | Required | Example            |
| --------- | ----------------------------------------- | -------- | ------------------ |
| Timestamp | `YYYY-MM-DDTHH:MM`                        | Yes      | `2026-01-05T18:11` |
| Directive | `create` or `update`                      | Yes      | `create`           |
| Entity    | `lore`, `opinion`, `reference`, `journal` | Yes      | `lore`             |
| Title     | Quoted string                             | Yes      | `"My title"`       |
| Link      | `^` + identifier                          | No       | `^my-linked-entry` |
| Tags      | `#` + identifier                          | No       | `#architecture`    |

### Metadata

Indented key-value pairs (2-space indent):

```
  key: value
  ref-type: article
  related: ^other-entry
  source: "Technical documentation"
```

- **Keys**: lowercase, may contain hyphens/underscores
- **Values**: plain text, quoted strings, or link references

### Content

Indented content after a blank line separator:

```
  # Section Header
  Regular paragraph text continues here
  across multiple lines.

  # Another Section
  More content with markdown-style headers.
```

- Content lines must be indented (2 spaces)
- Markdown headers (`#`, `##`, etc.) are recognized
- Blank lines within content are preserved

## Schema Entries

Define or alter entity schemas using `define-entity` and `alter-entity` directives:

```
{timestamp} define-entity {entity-name} "Description" [#tags...]
  # Metadata
  {field-name}?: {type} [= {default}] [; "description"]
  ...
  # Sections
  {SectionName}? [; "description"]
  ...
```

### Example

```ptall
2026-01-05T18:12 define-entity reference "Collected resources"
  # Metadata
  url?: string ; "the url to the resource"
  ref-type: "article" | "video" | "tweet"
  author?: string | link
  status?: "unread" | "read" = "unread"
  related?: link[]

  # Sections
  Summary ; "Brief summary of the content"
  KeyTakeaways?
```

### alter-entity

Modify existing entity schemas by adding or removing fields/sections:

```ptall
2026-01-10T14:00 alter-entity reference "Add published field, remove legacy"
  # Metadata
  published: date ; "publication date"
  # Remove Metadata
  legacy-field ; "deprecated in favor of new-field"

  # Sections
  NewSection? ; "added section"

  # Remove Sections
  OldSection ; "no longer needed"
```

### Type System (Schema Definitions)

| Type         | Example              | Description              |
| ------------ | -------------------- | ------------------------ |
| `string`     | `name: string`       | Free-form text           |
| `date`       | `published: date`    | Single date              |
| `date-range` | `period: date-range` | Date range (2022 ~ 2024) |
| `link`       | `related: link`      | Reference to entry       |
| Literal      | `status: "read"`     | Exact string value       |
| Union        | `type: "a" \| "b"`   | One of multiple types    |
| Array        | `tags: string[]`     | Array of type            |
| Default      | `status?: "a" = "a"` | Default value            |

## Typed Metadata Values

The grammar parses metadata values into typed AST nodes, enabling downstream validation without
regex-based parsing. Values are parsed in priority order:

### Query Expressions

Source queries for synthesis entries:

```ptall
sources: lore where subject = ^self and #career
sources: lore where type = "fact", journal where #reflection
```

**AST structure**: `query_list` → `query` → `query_conditions` → `query_condition`

Query conditions support:

- **Field conditions**: `field = value` or `field = "quoted value"` or `field = ^link`
- **Tag conditions**: `#tag`
- **Link conditions**: `^link-id`

### Date Ranges

Date ranges with the `~` separator:

```ptall
date: 2022 ~ 2024
period: 2022-05 ~ 2024-12-31
```

**AST node**: `date_range`

### Value Arrays

Comma-separated lists of links and/or quoted strings:

```ptall
related: ^ref1, ^ref2, ^ref3
authors: "Jane Doe", ^john-ref, "Alice Smith"
tags: "architecture", "distributed"
```

**AST structure**: `value_array` → `(link | quoted_value)*`

### Links

Single link references:

```ptall
subject: ^self
supersedes: ^previous-opinion
```

**AST node**: `link`

### Quoted Values

Values in double quotes (required for literal type matching):

```ptall
type: "fact"
confidence: "high"
```

**AST node**: `quoted_value`

### Plain Values

Fallback for unquoted text (sequence of value words):

```ptall
subject: acme-corp
mood: contemplative
```

**AST structure**: `plain_value` → `value_word+`

### Field Syntax

- **Required by default**: Fields without `?` are required
- **Optional marker**: `?` after field name makes it optional
- **Description**: `; "text"` adds documentation

### Section Names

- Must start with uppercase letter (PascalCase)
- Examples: `Summary`, `KeyTakeaways`, `Reasoning`

## AST Structure

### Instance Entry

```
source_file
└── entry
    └── instance_entry
        ├── instance_header
        │   ├── timestamp
        │   ├── instance_directive
        │   ├── entity
        │   ├── title
        │   ├── link?
        │   └── tag*
        ├── metadata*
        │   ├── key
        │   └── value
        └── content?
            ├── markdown_header*
            └── content_line*
```

### Schema Entry

```
source_file
└── entry
    └── schema_entry
        ├── schema_header
        │   ├── timestamp
        │   ├── schema_directive
        │   ├── identifier
        │   ├── title
        │   ├── link?
        │   └── tag*
        ├── metadata_block?
        │   └── field_definition*
        │       ├── field_name
        │       ├── optional_marker?
        │       ├── type_expression
        │       ├── default_value?
        │       └── description?
        ├── sections_block?
        │   └── section_definition*
        │       ├── section_name
        │       ├── optional_marker?
        │       └── description?
        ├── remove_metadata_block?
        │   └── field_removal*
        └── remove_sections_block?
            └── section_removal*
```

## Usage

```bash
# Generate parser
pnpm exec tree-sitter generate

# Run tests
pnpm exec tree-sitter test

# Parse a file
pnpm exec tree-sitter parse path/to/file.ptall
```

## Limitations

### General

- Titles cannot contain unescaped quotes
- Content text starting with `#` is always parsed as a markdown header
- Only 2-space indentation is supported
- Section names must be PascalCase
- Field names must be lowercase (kebab-case or camelCase)

### Typed Value Parsing

- **No inline comments in values**: Comments (`//`) after metadata values break parsing. Use a
  separate comment line instead.

  ```ptall
  # Wrong - causes parse error:
  type: fact // this breaks

  # Correct:
  // Note about type
  type: "fact"
  ```

- **Array elements must be links or quoted strings**: Plain values in arrays cause parse errors due
  to comma ambiguity.

  ```ptall
  # Wrong - parse error:
  dates: 2024, 2024-05, 2024-05-11

  # Correct:
  dates: "2024", "2024-05", "2024-05-11"
  ```

- **Single dates parsed as plain values**: The grammar cannot distinguish dates from other plain
  text, so `date: 2024-05-11` parses as `plain_value`. Validation happens at the semantic level.

- **Query `where` clause is required**: Entity-only queries (e.g., `lore` without `where`) parse as
  `plain_value`, not `query_list`.

  ```ptall
  # Parsed as query_list:
  sources: lore where #career

  # Parsed as plain_value (not a query):
  sources: lore
  ```

- **Empty values cause parse errors**: Metadata must have a value; use optional fields and omit the
  field entirely instead.

  ```ptall
  # Wrong - parse error:
  related:

  # Correct - omit the optional field entirely
  ```
