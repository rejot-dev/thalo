---
"@rejot-dev/thalo-cli": patch
---

fix CLI runtime bundling so `thalo lsp` works from linked workspaces even when `packages/thalo/dist`
has not been built.
