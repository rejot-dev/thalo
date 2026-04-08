# @rejot-dev/thalo

## 0.3.0

### Minor Changes

- 0b3b42c: Add a new `@rejot-dev/thalo/vfs` public API for loading Thalo workspaces from custom
  filesystem implementations, applying workspace file changes, and writing files with optimistic
  concurrency control. Also add `@rejot-dev/thalo/vfs/workspace` for browser-safe loading into a raw
  `Workspace`. Documentation now includes a dedicated VFS guide and updated scripting/README
  examples.

### Patch Changes

- 9813489: Fix `loadWorkspaceFromDirectory` so importing `@rejot-dev/thalo/files` does not require
  native parser dependencies like `tree-sitter` at runtime. This avoids `ERR_MODULE_NOT_FOUND`
  failures for consumers that only need workspace file loading, while keeping recursive scans
  practical by skipping hidden paths and `node_modules`.
  - @rejot-dev/tree-sitter-thalo@0.3.0

## 0.2.5

### Patch Changes

- a909cfb: feat: add filteredSince and schema-aware change tracking
- ac9c4c6: feat: add workspace.watch async iterator for change events
  - @rejot-dev/tree-sitter-thalo@0.2.5

## 0.2.4

### Patch Changes

- 53bba55: fix: Node.js 24 compatibility - use WASM fallback when native compilation fails
- Updated dependencies [53bba55]
  - @rejot-dev/tree-sitter-thalo@0.2.4

## 0.2.3

### Patch Changes

- @rejot-dev/tree-sitter-thalo@0.2.3

## 0.2.2

### Patch Changes

- Updated dependencies [ec09f91]
  - @rejot-dev/tree-sitter-thalo@0.2.2

## 0.2.1

### Patch Changes

- 3fe4a0c: Fix WASM fallback not activating when native tree-sitter bindings are unavailable; add
  git hash and parser backend to `--version` output.
  - @rejot-dev/tree-sitter-thalo@0.2.1

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
