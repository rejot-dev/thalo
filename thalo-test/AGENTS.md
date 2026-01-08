# THALO - Personal Thought And Lore Language

Entity schemas are defined in `entities.thalo`.

## Entry Syntax

```
{timestamp} {directive} {entity} "Title" [^link-id] [#tags...]
  {key}: {value}
  ...

  # Section
  {content}

```

- **timestamp**: ISO 8601 local time (`2026-01-05T15:30`)
- **directive**: `create` or `update`
- **entity**: `journal`, `opinion`, `reference`, or `lore`
- **^link-id**: Optional explicit ID for cross-referencing
- **#tag**: Optional categorization tags

## Metadata

Metadata fields are indented key-value pairs. See `entities.thalo` for required/optional fields per
entity. Values can be:

- Strings: `author: "Jane Doe"` or unquoted `author: Jane Doe`
- Links: `subject: ^self` or `related: ^my-other-entry`
- Dates: `published: 2023-03-16`
- Date ranges: `date: 2020 ~ 2021`

## Sections

Content sections start with `# SectionName` (indented). **All content must be within a section.**
Each entity type defines which sections are required/optional in `entities.thalo`.

## Example

```thalo
2026-01-05T16:00 create opinion "TypeScript enums should be avoided" ^opinion-ts-enums #typescript
  confidence: "high"

  # Claim
  TypeScript enums should be replaced with `as const` objects.

  # Reasoning
  - Enums generate runtime code
  - `as const` provides the same type safety with zero overhead
```

## Tips

- Run `date +"%Y-%m-%dT%H:%M"` to get the current timestamp
- Use `thalo check` to validate entries against schemas
