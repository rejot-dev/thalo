---
name: thalo
description: Use when working with Thalo (Thought And Lore Language): creating or editing .thalo files or thalo code blocks in Markdown, setting up a knowledge base with thalo-cli (init, check, actualize), defining entities/syntheses, or generating an AGENTS.md guide for collaborators.
---

# Thalo

## Quick start workflow

- Initialize a knowledge base with `thalo init` to generate `entities.thalo`, `AGENTS.md`, and
  `personal-bio.md`.
- Add or edit entries in `*.thalo` files or fenced ` ```thalo ` blocks inside Markdown.
- Validate after changes with `thalo check` to catch schema, link, and syntax issues.
- Run `thalo actualize` to materialize syntheses (queries + prompt) for LLM use.

## Writing entries

Follow this structure:

```
{timestamp} {directive} {entity} "Title" [^link-id] [#tags...]
  metadata: value

  # Section
  Content (markdown-ish)
```

Guidelines:

- Use ISO 8601 local time with timezone, e.g. `2026-01-05T15:30Z`.
- Use `create` for new entries and `update` for modifications.
- Provide a stable `^link-id` when you want to reference the entry elsewhere.
- Put all content inside sections; required sections are defined in `entities.thalo`.

## Defining entities

Define or update entities in `entities.thalo` using `define-entity` blocks. Each entity specifies:

- **Metadata** fields with types (`string`, `link`, `datetime`, `date-range`, enums, arrays,
  unions).
- **Sections** that determine required/optional content.

If you need the default entity templates, load `references/entities.thalo`.

## Syntheses

Syntheses are queries plus prompts that let you generate structured summaries or narratives.

- Create with `define-synthesis` blocks.
- Use `sources:` to select entries by entity, tag, or metadata filters.
- Run `thalo actualize` to output the sources and prompt for downstream LLM use.

## Working in Markdown

Thalo can live inside Markdown files:

````
```thalo
...entries...
```
````

The CLI and LSP will parse fenced `thalo` blocks in `.md` files.

## References

- Use `references/AGENTS.md` as a starting point for an agent-facing guide.
- Use `references/entities.thalo` for the default entity definitions from `thalo init`.
