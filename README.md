# Thalo

**Personal Thought And Lore Language**

A plain-text format for your knowledge. Structured enough to query, simple enough to jot.

```thalo
2026-01-08T14:30Z create opinion "Plain text is the universal interface" ^plain-text-ftw #pkm
  confidence: "high"

  # Claim
  When your knowledge lives in plain text, everything can read it and write it.

  # Reasoning
  - grep works. git works. your editor works.
  - AI writes plain text natively—no plugins, no export, no friction.
  - structured text gives AI the context it needs to help you think.
```

## Why Thalo?

AI is remarkably good at generating structured text. Thalo leans into this:

- **Plain text** — version control, grep, your favorite editor
- **Structured** — not just markdown soup, actual typed entries with metadata
- **Queryable** — cross-reference with `^links`, filter by `#tags`, define syntheses
- **AI-ready** — feed your knowledge base to LLMs with full context

Your notes become a collaboration between you and AI, versioned in git, readable forever.

## The Syntax in 30 Seconds

```thalo
{timestamp} {directive} {entity} "Title" [^id] [#tags...]
  metadata: "value"
  related: ^other-entry

  # Section
  Your content here. Markdown-ish.
```

**Entities** are defined with `define-entity` — you decide what types of knowledge you track
(journals, opinions, references, whatever fits your brain). `thalo init` creates some starters.
**Links:** `^clean-code` references another entry. **Tags:** `#programming #books` for filtering.

## Syntheses

Define queries over your knowledge base with prompts for AI:

```thalo
2026-01-08T14:30Z define-synthesis "My Programming Philosophy" ^prog-philosophy #programming
  sources: opinion where #programming, lore where #insights

  # Prompt
  Synthesize my programming opinions and insights into a coherent philosophy.
  Note any contradictions or evolution in my thinking.
```

Scattered thoughts → structured query → synthesized understanding.

## Ecosystem

| Tool                | Status   | What it does                                |
| ------------------- | -------- | ------------------------------------------- |
| `thalo-cli`         | 🚧 Alpha | `init`, `check`, validate against schemas   |
| `thalo-lsp`         | 🚧 Alpha | Autocomplete, diagnostics, go-to-definition |
| `thalo-vscode`      | 🚧 Alpha | Syntax highlighting + LSP integration       |
| `thalo-prettier`    | 🚧 Alpha | Auto-format your `.thalo` files             |
| Tree-sitter grammar | 🚧 Alpha | Full parser for tooling                     |

## Try It

```bash
git clone https://github.com/rejot-dev/thalo.git
cd thalo
CXXFLAGS="-std=c++20" pnpm install
pnpm build

cd apps/thalo-cli && pnpm link --global
thalo --help
```

## Status

🚧 **Alpha** — The initial implementation was vibe-engineered in a couple days (tree-sitter grammar,
language semantic package, Prettier support, LSP, VSCode extension). Things are not polished or
stable.

## License

MIT
