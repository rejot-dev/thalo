# TypeScript Guide

```thalo
2026-01-07T14:20Z define-synthesis "TypeScript Best Practices" ^typescript-guide #typescript
  sources: opinion where #typescript, reference where #typescript

  # Prompt
  Create a best practices guide for TypeScript based on my opinions and the references I've
  collected. Include my stance on enums and link to relevant resources.

2026-04-08T12:23:12Z actualize-synthesis ^typescript-guide
  checkpoint: "git:cdb9aae983e6bc0b75eff1606bc99b088c3aebff"
```

# TypeScript Best Practices

2026-01-07T14:20Z define-synthesis "TypeScript Best Practices" ^typescript-guide #typescript
  sources: opinion where #typescript, reference where #typescript

  # Prompt
  Create a best practices guide for TypeScript based on my opinions and the references I've
  collected. Include my stance on enums and link to relevant resources.

  # Guide
  This guide distills collected opinions and references into actionable best practices for
  day-to-day TypeScript development. It focuses on maintainability, predictable runtime
  behavior, and tooling compatibility.

  ## Core principles
  - Prefer clear, explicit types and keep intent readable for humans and tools.
  - Favor standard JavaScript semantics when possible to avoid surprising runtime artifacts.
  - Optimize for predictable build artifact size and tree-shaking.
  - Use strict compiler settings (e.g., strict: true) for better correctness, but apply
    pragmatic exceptions when necessary.

  ## Recommended tsconfig flags
  - strict: true (default for new projects)
  - target: es2020+ (when supported by runtime) to reduce transpilation surface
  - useIncrementalCompilerOptions and composite where appropriate for monorepos
  - take advantage of "extends" in tsconfig for shared base configs (see TypeScript 5.0 features) ^typescript-5

  ## Types and inference
  - Prefer small, focused interfaces and type aliases. Keep unions and discriminated unions
    explicit where they improve safety.
  - Use `const` assertions (as const) to preserve literal types when exporting static maps or
    value sets.
  - Use `as const` + type derivation to create strongly typed value maps without emitting
    extra runtime code.

  ## Enums — my stance
  - Generally avoid TypeScript enums in new code. (See ^opinion-ts-enums and ^opinion-const-vs-enums.)
  - Prefer `as const` objects or string literal unions for most use cases:
    - `as const` objects do not emit special runtime enum code and play nicely with tooling
      and tree-shaking.
    - String literal unions are simple and fully type-checked with no runtime overhead.
  - Caveats:
    - Const enums (const enum) can be useful in highly performance-sensitive and controlled
      environments because they are inlined, but they require careful build/toolchain support
      and can break when types are stripped or when using Babel without TypeScript transform.
    - Numeric enums have auto-increment and runtime semantics that can surprise maintainers.
    - String enums are less problematic than numeric enums, but they still emit runtime objects.
  - Practical examples:
    - Bad: export enum Status { Open = 0, Closed = 1 }
    - Good: export const STATUS = { Open: 'open', Closed: 'closed' } as const
             export type Status = typeof STATUS[keyof typeof STATUS]
  - Related reading:
    - TypeScript const assertions beat enums (opinion) ^opinion-const-vs-enums
    - TypeScript enums should be avoided (opinion) ^opinion-ts-enums

  ## Module and runtime considerations
  - Keep runtime footprint low: prefer plain objects and functions over constructs that emit
    complex helper code.
  - When publishing libraries, test consumption from plain JavaScript and common bundlers to
    ensure no surprises (especially with enums and const enums).

  ## Tooling and build performance
  - Upgrade to recent TypeScript versions for performance improvements and features (see
    TypeScript 5.0 release notes) ^typescript-5.
  - Use project references and incremental builds for large codebases.
  - Prefer language-server-friendly patterns (avoid excessive computed key types and very
    large union types that slow down IntelliSense).

  ## Migration and interoperability
  - When converting enums to const objects:
    - Provide types derived from the object (type from typeof pattern).
    - Gradually replace usage sites; avoid large, simultaneous rewrites.
  - Document any non-standard compilation flags (e.g., const enum usage) so downstream
    consumers are aware.

  ## Misc practical tips
  - Use `as const` for literal-rich values to preserve narrow types.
  - Prefer explicit return types on public API functions.
  - Keep types small and test-driven — add unit tests that assert expected type-derived values
    when feasible (e.g., via small type-level tests or runtime consistency checks).

  ## Resources
  - TypeScript 5.0 Release Notes (features and performance): ^typescript-5
  - Opinion: TypeScript const assertions beat enums: ^opinion-const-vs-enums
  - Opinion: TypeScript enums should be avoided: ^opinion-ts-enums

  # Notes
  - Wilco is awesome ;^)
