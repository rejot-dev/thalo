# Ptall VS Code Extension

Syntax highlighting and formatting for **ptall** (Personal Thought And Lore Language) files in VS
Code.

## Features

- Syntax highlighting for `.ptall` files
- Syntax highlighting for ptall code blocks in Markdown (` ```ptall `)
- Comment toggling with `//`
- Document formatting via Prettier (uses `@rejot-dev/ptall-prettier`)

## Highlighted Elements

| Element          | Scope                             |
| ---------------- | --------------------------------- |
| Timestamps       | `constant.numeric.timestamp`      |
| Directives       | `keyword.control.directive`       |
| Entity types     | `entity.name.type`                |
| Titles           | `string.quoted.double.title`      |
| Links (`^ref`)   | `entity.name.tag.link`            |
| Tags (`#tag`)    | `entity.other.attribute-name.tag` |
| Metadata keys    | `variable.other.property`         |
| Primitive types  | `support.type.primitive`          |
| Markdown headers | `markup.heading`                  |
| Comments         | `comment.line.double-slash`       |

## Development

```bash
# Build the extension
pnpm build

# Package for distribution
pnpm package
```

## Installation

For local development, use VS Code's "Developer: Install Extension from Location..." command and
point to this directory.
