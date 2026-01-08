# Knowledge Center

A personal knowledge management system.

## Setup

```bash
CXXFLAGS="-std=c++20" pnpm install
```

**Why C++20?** Node.js 24 requires C++20 for its native addon headers (`v8.h`, `node.h`). The
`tree-sitter` package (used by `@rejot-dev/grammar`) compiles native code but doesn't set `-std=c++20`
in its build config. Without this flag, compilation fails with:

```
error: "C++20 or later required."
```

This only affects initial install or when `tree-sitter` is rebuilt.
