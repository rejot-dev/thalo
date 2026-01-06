# @wilco/grammar

A Tree-Sitter grammar for parsing **ptall** (Personal Thought And Lore Language) entries used in the
Knowledge Center.

## Overview

Ptall is a Beancount-inspired syntax for recording structured knowledge entries including lore,
opinions, references, and journal entries.

## Syntax

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

## Supported Elements

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

## AST Structure

```
source_file
└── entry
    ├── header
    │   ├── timestamp
    │   ├── directive
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

- Titles cannot contain unescaped quotes
- Content text starting with `#` is always parsed as a markdown header
- Only 2-space indentation is supported
