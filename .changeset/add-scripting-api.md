---
"@rejot-dev/thalo": minor
---

Add new scripting API (`@rejot-dev/thalo/api`) for programmatic access to Thalo workspaces.

Features:

- `loadThalo()` / `loadThaloFiles()` for loading workspaces
- Iterate over entries with `entries()`, `entriesInFile()`, and typed variants
- Navigate with `findDefinition("^link")` and `findReferences("^link" | "#tag")`
- Query entries using Thalo's query syntax: `workspace.query("opinion where #coding")`
- Validate with `check()` method
- Write custom logic with `visit()` using the visitor pattern

Note: `findDefinition()` and `findReferences()` require explicit prefixes (`^` for links, `#` for
tags).
