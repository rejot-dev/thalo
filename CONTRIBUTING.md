# Contributing to Thalo

## Patches

This project includes a **pnpm patch** for `web-tree-sitter` that enables:

1. **`Language.loadModuleSync()`** — Load languages from pre-compiled `WebAssembly.Module` instances
   (needed for Cloudflare Workers where WASM imports are modules, not bytes)
2. **Cloudflare Workers compatibility** — Forces `ENVIRONMENT_IS_NODE = false` and adds
   `self.location` polyfill to work around Emscripten's environment detection

The patch is at `patches/web-tree-sitter@0.25.10.patch` and is applied automatically by pnpm.

### Modifying the Patch

To modify the patch:

```bash
# Start editing the patched package
pnpm patch web-tree-sitter@0.25.10

# Make your changes in the directory it outputs, then commit:
pnpm patch-commit '/path/to/node_modules/.pnpm_patches/web-tree-sitter@0.25.10'
```

This updates the patch file in `patches/` which should be committed to git.
