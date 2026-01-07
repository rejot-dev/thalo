/**
 * Language constants for ptall syntax.
 * Shared across packages (ptall, ptall-lsp, ptall-cli, etc.)
 */

// ===================
// Directives
// ===================

/** Directives for instance entries (create/update lore, opinion, etc.) */
export const INSTANCE_DIRECTIVES = ["create", "update"] as const;

/** Directives for schema entries (define-entity/alter-entity) */
export const SCHEMA_DIRECTIVES = ["define-entity", "alter-entity"] as const;

/** Directives for synthesis entries (define-synthesis/actualize-synthesis) */
export const SYNTHESIS_DIRECTIVES = ["define-synthesis", "actualize-synthesis"] as const;

/** All directives */
export const ALL_DIRECTIVES = [
  ...INSTANCE_DIRECTIVES,
  ...SCHEMA_DIRECTIVES,
  ...SYNTHESIS_DIRECTIVES,
] as const;

// ===================
// Primitive Types (for schema definitions)
// ===================

/** Primitive types for field definitions */
export const PRIMITIVE_TYPES = ["string", "date", "date-range", "link"] as const;

// ===================
// Schema Block Headers
// ===================

/** Block headers used in define-entity/alter-entity */
export const SCHEMA_BLOCK_HEADERS = [
  "# Metadata",
  "# Sections",
  "# Remove Metadata",
  "# Remove Sections",
] as const;

// ===================
// Type Utilities
// ===================

export type InstanceDirective = (typeof INSTANCE_DIRECTIVES)[number];
export type SchemaDirective = (typeof SCHEMA_DIRECTIVES)[number];
export type SynthesisDirective = (typeof SYNTHESIS_DIRECTIVES)[number];
export type Directive = (typeof ALL_DIRECTIVES)[number];
export type PrimitiveType = (typeof PRIMITIVE_TYPES)[number];
export type SchemaBlockHeader = (typeof SCHEMA_BLOCK_HEADERS)[number];

// ===================
// Type Guards
// ===================

export function isInstanceDirective(value: string): value is InstanceDirective {
  return (INSTANCE_DIRECTIVES as readonly string[]).includes(value);
}

export function isSchemaDirective(value: string): value is SchemaDirective {
  return (SCHEMA_DIRECTIVES as readonly string[]).includes(value);
}

export function isSynthesisDirective(value: string): value is SynthesisDirective {
  return (SYNTHESIS_DIRECTIVES as readonly string[]).includes(value);
}

export function isDirective(value: string): value is Directive {
  return (ALL_DIRECTIVES as readonly string[]).includes(value);
}

export function isPrimitiveType(value: string): value is PrimitiveType {
  return (PRIMITIVE_TYPES as readonly string[]).includes(value);
}
