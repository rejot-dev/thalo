---
"@rejot-dev/thalo": patch
---

Fix `loadWorkspaceFromDirectory` so importing `@rejot-dev/thalo/files` does not require native
parser dependencies like `tree-sitter` at runtime. This avoids `ERR_MODULE_NOT_FOUND` failures for
consumers that only need workspace file loading, while keeping recursive scans practical by skipping
hidden paths and `node_modules`.
