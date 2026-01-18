# @rejot-dev/thalo

## 0.2.0

### Minor Changes

- dab147a: Add new scripting API (`@rejot-dev/thalo/api`) for programmatic access to Thalo
  workspaces.

  Features:
  - `loadThalo()` / `loadThaloFiles()` for loading workspaces
  - Iterate over entries with `entries()`, `entriesInFile()`, and typed variants
  - Navigate with `findDefinition("^link")` and `findReferences("^link" | "#tag")`
  - Query entries using Thalo's query syntax: `workspace.query("opinion where #coding")`
  - Validate with `check()` method
  - Write custom logic with `visit()` using the visitor pattern

  Note: `findDefinition()` and `findReferences()` require explicit prefixes (`^` for links, `#` for
  tags).

### Patch Changes

- dd5e57e: Add Node.js parser fallback to WASM when native bindings are unavailable.
  - @rejot-dev/tree-sitter-thalo@0.2.0

## 0.1.0

### Minor Changes

- 77f7f8b: feat: initial release

### Patch Changes

- Updated dependencies [77f7f8b]
  - @rejot-dev/tree-sitter-thalo@0.1.0
