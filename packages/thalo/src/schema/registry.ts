import type { ModelSchemaEntry, ModelDefaultValue } from "../model/types.js";
import type { EntitySchema, FieldSchema, SectionSchema } from "./types.js";

/**
 * Registry for entity schemas.
 * Collects define-entity and alter-entity entries and resolves them into EntitySchemas.
 */
export class SchemaRegistry {
  private schemas = new Map<string, EntitySchema>();
  private defineEntries = new Map<string, ModelSchemaEntry>();
  private alterEntries = new Map<string, ModelSchemaEntry[]>();

  /**
   * Add a schema entry (define-entity or alter-entity)
   */
  add(entry: ModelSchemaEntry): void {
    if (entry.directive === "define-entity") {
      this.defineEntries.set(entry.entityName, entry);
    } else {
      const alters = this.alterEntries.get(entry.entityName) ?? [];
      alters.push(entry);
      this.alterEntries.set(entry.entityName, alters);
    }

    // Clear cached schema to force re-resolution
    this.schemas.delete(entry.entityName);
  }

  /**
   * Get a resolved entity schema by name
   */
  get(name: string): EntitySchema | undefined {
    // Return cached if available
    if (this.schemas.has(name)) {
      return this.schemas.get(name);
    }

    // Try to resolve
    const schema = this.resolve(name);
    if (schema) {
      this.schemas.set(name, schema);
    }
    return schema;
  }

  /**
   * Check if an entity is defined
   */
  has(name: string): boolean {
    return this.defineEntries.has(name);
  }

  /**
   * Get all defined entity names
   */
  entityNames(): string[] {
    return Array.from(this.defineEntries.keys());
  }

  /**
   * Clear all schemas
   */
  clear(): void {
    this.schemas.clear();
    this.defineEntries.clear();
    this.alterEntries.clear();
  }

  /**
   * Resolve an entity schema from its define and alter entries
   */
  private resolve(name: string): EntitySchema | undefined {
    const defineEntry = this.defineEntries.get(name);
    if (!defineEntry) {
      return undefined;
    }

    // Start with the base schema from define-entity
    const schema: EntitySchema = {
      name,
      description: defineEntry.title,
      fields: new Map(),
      sections: new Map(),
      definedAt: defineEntry.timestamp,
      definedIn: defineEntry.file,
    };

    // Add fields from define-entity
    for (const field of defineEntry.fields) {
      schema.fields.set(field.name, {
        name: field.name,
        optional: field.optional,
        type: field.type,
        defaultValue: field.defaultValue,
        description: field.description,
      });
    }

    // Add sections from define-entity
    for (const section of defineEntry.sections) {
      schema.sections.set(section.name, {
        name: section.name,
        optional: section.optional,
        description: section.description,
      });
    }

    // Apply alter-entity entries in order (by timestamp)
    const alters = this.alterEntries.get(name) ?? [];
    const sortedAlters = [...alters].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

    for (const alter of sortedAlters) {
      this.applyAlter(schema, alter);
    }

    return schema;
  }

  /**
   * Apply an alter-entity entry to a schema
   */
  private applyAlter(schema: EntitySchema, alter: ModelSchemaEntry): void {
    // Add/update fields
    for (const field of alter.fields) {
      schema.fields.set(field.name, {
        name: field.name,
        optional: field.optional,
        type: field.type,
        defaultValue: field.defaultValue,
        description: field.description,
      });
    }

    // Add/update sections
    for (const section of alter.sections) {
      schema.sections.set(section.name, {
        name: section.name,
        optional: section.optional,
        description: section.description,
      });
    }

    // Remove fields
    for (const fieldName of alter.removeFields) {
      schema.fields.delete(fieldName);
    }

    // Remove sections
    for (const sectionName of alter.removeSections) {
      schema.sections.delete(sectionName);
    }
  }
}

/**
 * Create a field schema helper
 */
export function createFieldSchema(
  name: string,
  optional: boolean,
  type: FieldSchema["type"],
  defaultValue?: ModelDefaultValue | null,
  description?: string,
): FieldSchema {
  return {
    name,
    optional,
    type,
    defaultValue: defaultValue ?? null,
    description: description ?? null,
  };
}

/**
 * Create a section schema helper
 */
export function createSectionSchema(
  name: string,
  optional: boolean,
  description?: string,
): SectionSchema {
  return {
    name,
    optional,
    description: description ?? null,
  };
}
