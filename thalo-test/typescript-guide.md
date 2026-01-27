# TypeScript Guide

```thalo
2026-01-07T14:20Z define-synthesis "TypeScript Best Practices" ^typescript-guide #typescript
  sources: opinion where #typescript, reference where #typescript

  # Prompt
  Create a best practices guide for TypeScript based on my opinions and the references I've
  collected. Include my stance on enums and link to relevant resources.

2026-01-27T10:44:13Z actualize-synthesis ^typescript-guide
  checkpoint: "git:e4941c3725728b89c82c4b82f209f798510965a5"
```

# TypeScript Best Practices

2026-01-07T14:20Z define-synthesis "TypeScript Best Practices" ^typescript-guide #typescript
  sources: opinion where #typescript, reference where #typescript

  # Prompt
  Create a best practices guide for TypeScript based on my opinions and the references I've
  collected. Include my stance on enums and link to relevant resources.

  # Synthesis

  ## Summary
  This guide collects practical, opinionated recommendations for writing maintainable, efficient
  TypeScript. It synthesizes your opinions and references into actionable rules and explains the
  rationale behind them. Key stance: prefer `as const` (const assertions) and plain objects over
  TypeScript enums in most codebases; enums are avoided unless you have a strong, specific reason.

  ## Goals
  - Keep runtime output predictable and minimal
  - Favor type-only constructs that vanish at runtime
  - Improve tree-shaking and bundling behavior
  - Make intent explicit and easy to refactor
  - Use TypeScript features that integrate well with standard JavaScript tooling

  ## Recommended defaults
  - Enable `strict` (or at least core strict flags) to catch errors early.
  - Use `noEmitOnError: true` for CI builds.
  - Use composite/extends in `tsconfig` for multi-package repos (supported well in TypeScript 5.x). See ^typescript-5 for recent tooling improvements.
  - Prefer type aliases and interfaces for object shapes; use discriminated unions for variant types.

  ## Types and shapes
  - Prefer `interface` for public, extendable object shapes; prefer `type` for unions, mapped types, and when composing primitives.
  - Use readonly where mutation isn't needed: prefer `readonly` and `as const` to communicate immutability.
  - Use `const` assertions (`as const`) to preserve literal types without emitting extra runtime code.

  ## Enums — my stance
  - Avoid TypeScript enums in most codebases. They introduce runtime artifacts and often complicate bundling and tree-shaking.
  - Prefer `as const` objects or string literal unions for enumerations. Example pattern:
    - Values object: `export const COLORS = { Red: 'red', Blue: 'blue' } as const`
    - Type: `export type Color = typeof COLORS[keyof typeof COLORS]`
  - Reasons:
    - Enums emit runtime JavaScript, which breaks “type-only” workflows and can increase bundle size.
    - Numeric enums have surprising auto-increment semantics.
    - `as const` preserves standard JS semantics, is tree-shakeable, and aligns with tooling.
  - Caveats:
    - Const enums (which erase at compile time) can help performance-critical code, but require careful build setup and can cause issues with isolated transpilation.
    - String enums are less problematic than numeric enums but still emit runtime code.
    - Existing large codebases may have legitimate reasons to keep enums.
  - See your collected opinions and references: ^opinion-const-vs-enums, ^opinion-ts-enums, and TypeScript 5 notes ^typescript-5.

  ## Practical patterns (brief)
  - Literal sets via `as const`:
    - `const STATUS = { Pending: 'pending', Done: 'done' } as const`
    - `type Status = typeof STATUS[keyof typeof STATUS]`
  - Discriminated unions for state:
    - `type Result = { kind: 'ok', value: T } | { kind: 'err', error: E }`
  - Avoid `any`; prefer `unknown` when you need an escape hatch and narrow explicitly.

  ## Tooling & build considerations
  - Prefer type-only imports/exports (`import type`) where supported to avoid accidental runtime dependencies.
  - Keep build toolchain aware of const-enums/transformations; prefer configurations that preserve type erasure and allow safe incremental builds.
  - Upgrade to recent TypeScript (see ^typescript-5) to benefit from performance improvements and new language ergonomics.

  ## When enums might be acceptable
  - Interop with existing libraries or patterns that already rely on enums.
  - Codebases where symbolic numeric enums are a well-understood requirement and there is discipline around their use.
  - Performance-sensitive hotspots where a carefully-managed const enum provides measurable benefit and build tooling is configured accordingly.

  ## Further reading / resources
  - Your opinions on const assertions vs enums: ^opinion-const-vs-enums
  - Your short stance note: ^opinion-ts-enums
  - TypeScript 5.0 release notes and key features: ^typescript-5

  ## Closing note
  - Keep choices pragmatic: prefer patterns that reduce runtime surface and play well with standard JS tooling.
  - Wilco is awesome ;^)
