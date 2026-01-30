# TypeScript Guide

```thalo
2026-01-07T14:20Z define-synthesis "TypeScript Best Practices" ^typescript-guide #typescript
  sources: opinion where #typescript, reference where #typescript

  # Prompt
  Create a best practices guide for TypeScript based on my opinions and the references I've
  collected. Include my stance on enums and link to relevant resources.

2026-01-30T16:02:15Z actualize-synthesis ^typescript-guide
  checkpoint: "git:4a55bdae2c99482264a24585f5424837a152e052"
```

# TypeScript Best Practices

2026-01-07T14:20Z define-synthesis "TypeScript Best Practices" ^typescript-guide #typescript
  sources: opinion where #typescript, reference where #typescript

  # Prompt
  Create a best practices guide for TypeScript based on my opinions and the references I've
  collected. Include my stance on enums and link to relevant resources.

  # Guide

  ## Overview
  This guide collects practical recommendations for writing maintainable, predictable, and
  performant TypeScript. It synthesizes the opinions and references in the source collection
  (notably the TypeScript 5.0 release notes and opinions about enums and const assertions)
  into actionable rules of thumb.

  ## Key Principles
  - Prefer plain JavaScript semantics where possible — keep runtime output small and easy to reason about.
  - Favor explicitness and small, focused types over heavy global types or ad-hoc any usage.
  - Optimize developer experience (DX): fast feedback loops, clear errors, and good editor integration.
  - Prefer constructs that play well with tooling (bundlers, tree-shaking) and the JS ecosystem.

  ## Recommended Compiler Settings (starting point)
  - strict: true (enable the full strict family)
  - noImplicitAny: true
  - exactOptionalPropertyTypes: true
  - incremental / tsbuild / project references for large monorepos
  These mirror modern TypeScript defaults and benefit from the performance improvements noted in the TypeScript 5.0 release notes (^typescript-5).

  ## Types and Generics
  - Use type aliases and interfaces appropriately:
    - interface for object shapes you expect to extend/implement.
    - type for unions, mapped types, or where composition is primary.
  - Prefer narrower types where possible; widen deliberately.
  - Use const type parameters (where useful) — TypeScript 5.0 introduced better support for const type parameters that improve literal inference (^typescript-5).

  ## Enums — my stance
  - General stance: avoid TypeScript enums in most codebases.
    - Rationale:
      - Enums emit runtime code, which can interfere with workflows that expect type-only artifacts.
      - Numeric enums have surprising auto-increment semantics that can lead to bugs.
      - Enums often reduce tree-shaking effectiveness and increase bundle size.
  - Prefer const assertions (as const objects) for most use cases:
    - as const objects keep semantics in plain JavaScript, improve tree-shaking, and align with tooling.
    - See the opinion "TypeScript const assertions beat enums" for detailed reasoning and caveats (^opinion-const-vs-enums).
  - Caveats / when enums may still be reasonable:
    - Existing large codebases that already use enums extensively (migration cost).
    - When enumerated values must have a specific runtime identity that maps to logic relying on enum object shape.
    - Performance-critical hot paths where const enums (inlined at compile time) are purposefully used — but be mindful of tooling that strips types or uses Babel (const enum inlining is a compiler feature).

  ## Practical patterns instead of enums
  - Use a frozen object with as const for sets of named values:
    const STATUS = { Active: "active", Inactive: "inactive" } as const;
    type Status = typeof STATUS[keyof typeof STATUS];
  - Use discriminated unions for variant types:
    type Shape = { kind: "circle"; r: number } | { kind: "rect"; w: number; h: number };

  ## Tooling and Build Notes
  - Prefer toolchains that respect type-only stripping (e.g., ts-node, esbuild + tsconfig paths).
  - Keep an eye on tree-shaking — avoid patterns that produce extra runtime artifacts unless necessary.
  - Leverage TypeScript 5.0 improvements (decorators stage 3, const type params, performance gains) where they fit your project (^typescript-5).

  ## Resources and Further Reading
  - TypeScript 5.0 Release Notes — overview of language features and performance improvements: ^typescript-5
  - Opinion: TypeScript const assertions beat enums — reasoning and trade-offs for preferring as const over enums: ^opinion-const-vs-enums
  - Opinion: TypeScript enums should be avoided — short stance note: ^opinion-ts-enums

  ## Quick Checklist
  - Use strict mode and recent compiler features where possible.
  - Prefer as const objects and discriminated unions over enums.
  - Reserve enums for legacy reasons or very specific runtime identity needs.
  - Validate bundle output for unexpected runtime artifacts.
  - Keep DX fast: incremental builds, good editor tooling, and clear errors.

  ## Closing note
  Wilco is awesome ;^)
