import type { Workspace } from "../model/workspace.js";
import type { Location, Entry, SchemaEntry, InstanceEntry } from "../ast/ast-types.js";

// ===================
// Entity Navigation
// ===================

/**
 * Result of finding an entity definition (define-entity)
 */
export interface EntityDefinitionResult {
  /** The file containing the definition */
  file: string;
  /** Location of the definition */
  location: Location;
  /** The schema entry that defines this entity */
  entry: SchemaEntry;
}

/**
 * A reference to an entity (instance entry using that entity type)
 */
export interface EntityReferenceLocation {
  /** The file containing the reference */
  file: string;
  /** Location of the entry using this entity */
  location: Location;
  /** The instance entry using this entity */
  entry: InstanceEntry | SchemaEntry;
  /** Whether this is the definition (always false for entity refs) */
  isDefinition: boolean;
}

/**
 * Result of finding entity references
 */
export interface EntityReferencesResult {
  /** The entity name */
  entityName: string;
  /** The definition (if it exists) */
  definition: EntityDefinitionResult | undefined;
  /** All instance entries using this entity */
  references: EntityReferenceLocation[];
  /** All locations (definition + references if includeDefinition) */
  locations: (EntityDefinitionResult | EntityReferenceLocation)[];
}

/**
 * Find the define-entity for an entity name
 *
 * @param workspace - The workspace to search in
 * @param entityName - The entity name to find
 * @returns The definition result, or undefined if not found
 */
export function findEntityDefinition(
  workspace: Workspace,
  entityName: string,
): EntityDefinitionResult | undefined {
  for (const model of workspace.allModels()) {
    for (const entry of model.ast.entries) {
      if (
        entry.type === "schema_entry" &&
        entry.header.directive === "define-entity" &&
        entry.header.entityName.value === entityName
      ) {
        return {
          file: model.file,
          location: entry.location,
          entry,
        };
      }
    }
  }
  return undefined;
}

/**
 * Find all references to an entity type
 *
 * @param workspace - The workspace to search in
 * @param entityName - The entity name to find references for
 * @param includeDefinition - Whether to include the definition in results
 * @returns The references result
 */
export function findEntityReferences(
  workspace: Workspace,
  entityName: string,
  includeDefinition = true,
): EntityReferencesResult {
  const definition = findEntityDefinition(workspace, entityName);

  // Find all instance entries using this entity
  const references: EntityReferenceLocation[] = [];

  for (const model of workspace.allModels()) {
    for (const entry of model.ast.entries) {
      if (entry.type === "instance_entry" && entry.header.entity === entityName) {
        references.push({
          file: model.file,
          location: entry.location,
          entry,
          isDefinition: false,
        });
      }

      // Also find alter-entity entries that reference this entity
      if (
        entry.type === "schema_entry" &&
        entry.header.directive === "alter-entity" &&
        entry.header.entityName.value === entityName
      ) {
        references.push({
          file: model.file,
          location: entry.location,
          entry,
          isDefinition: false,
        });
      }
    }
  }

  const locations: (EntityDefinitionResult | EntityReferenceLocation)[] = [];
  if (includeDefinition && definition) {
    locations.push(definition);
  }
  locations.push(...references);

  return {
    entityName,
    definition,
    references,
    locations,
  };
}

// ===================
// Tag Navigation
// ===================

/**
 * A reference to a tag (entry with that tag)
 */
export interface TagReferenceLocation {
  /** The file containing the reference */
  file: string;
  /** Location of the entry with this tag */
  location: Location;
  /** The entry with this tag */
  entry: Entry;
}

/**
 * Result of finding tag references
 */
export interface TagReferencesResult {
  /** The tag name (without # prefix) */
  tagName: string;
  /** All entries with this tag */
  references: TagReferenceLocation[];
}

/**
 * Get tags from an entry
 */
function getEntryTags(entry: Entry): string[] {
  switch (entry.type) {
    case "instance_entry":
      return entry.header.tags.map((t) => t.name);
    case "schema_entry":
      return entry.header.tags.map((t) => t.name);
    case "synthesis_entry":
      return entry.header.tags.map((t) => t.name);
    case "actualize_entry":
      // Actualize entries don't have tags
      return [];
  }
}

/**
 * Find all entries with a given tag
 *
 * @param workspace - The workspace to search in
 * @param tagName - The tag name (without # prefix)
 * @returns The references result
 */
export function findTagReferences(workspace: Workspace, tagName: string): TagReferencesResult {
  const references: TagReferenceLocation[] = [];

  for (const model of workspace.allModels()) {
    for (const entry of model.ast.entries) {
      if (getEntryTags(entry).includes(tagName)) {
        references.push({
          file: model.file,
          location: entry.location,
          entry,
        });
      }
    }
  }

  return {
    tagName,
    references,
  };
}

// ===================
// Metadata Field Navigation
// ===================

/**
 * Result of finding a field definition
 */
export interface FieldDefinitionResult {
  /** The file containing the definition */
  file: string;
  /** Location of the field definition */
  location: Location;
  /** The entity name this field belongs to */
  entityName: string;
  /** The schema entry containing this field */
  schemaEntry: SchemaEntry;
}

/**
 * A reference to a field (instance entry using that metadata key)
 */
export interface FieldReferenceLocation {
  /** The file containing the reference */
  file: string;
  /** Location of the metadata line */
  location: Location;
  /** The instance entry using this field */
  entry: InstanceEntry;
}

/**
 * Result of finding field references
 */
export interface FieldReferencesResult {
  /** The field name */
  fieldName: string;
  /** The entity context (if known) */
  entityName: string | undefined;
  /** The definition (if it exists) */
  definition: FieldDefinitionResult | undefined;
  /** All instance entries using this field */
  references: FieldReferenceLocation[];
}

/**
 * Find the field definition in a schema
 *
 * @param workspace - The workspace to search in
 * @param fieldName - The field name to find
 * @param entityName - Optional entity name to constrain the search
 * @returns The definition result, or undefined if not found
 */
export function findFieldDefinition(
  workspace: Workspace,
  fieldName: string,
  entityName?: string,
): FieldDefinitionResult | undefined {
  // If entityName is provided, look in that entity's schema
  if (entityName) {
    const schema = workspace.schemaRegistry.get(entityName);
    if (schema) {
      const field = schema.fields.get(fieldName);
      if (field) {
        // Find the schema entry that defines this field
        for (const model of workspace.allModels()) {
          for (const entry of model.ast.entries) {
            if (entry.type !== "schema_entry") {
              continue;
            }
            if (entry.header.entityName.value !== entityName) {
              continue;
            }

            const fieldDef = entry.metadataBlock?.fields.find((f) => f.name.value === fieldName);
            if (fieldDef) {
              return {
                file: model.file,
                location: fieldDef.location,
                entityName,
                schemaEntry: entry,
              };
            }
          }
        }
      }
    }
    return undefined;
  }

  // Without entityName, search all schemas
  for (const schemaEntityName of workspace.schemaRegistry.entityNames()) {
    const result = findFieldDefinition(workspace, fieldName, schemaEntityName);
    if (result) {
      return result;
    }
  }

  return undefined;
}

/**
 * Find all references to a field
 *
 * @param workspace - The workspace to search in
 * @param fieldName - The field name to find references for
 * @param entityName - Optional entity name to constrain the search
 * @returns The references result
 */
export function findFieldReferences(
  workspace: Workspace,
  fieldName: string,
  entityName?: string,
): FieldReferencesResult {
  const definition = findFieldDefinition(workspace, fieldName, entityName);

  const references: FieldReferenceLocation[] = [];

  for (const model of workspace.allModels()) {
    for (const entry of model.ast.entries) {
      if (entry.type !== "instance_entry") {
        continue;
      }

      // If entityName is specified, only look at entries of that entity type
      if (entityName && entry.header.entity !== entityName) {
        continue;
      }

      const meta = entry.metadata.find((m) => m.key.value === fieldName);
      if (meta) {
        references.push({
          file: model.file,
          location: meta.location,
          entry,
        });
      }
    }
  }

  return {
    fieldName,
    entityName,
    definition,
    references,
  };
}

// ===================
// Section Navigation
// ===================

/**
 * Result of finding a section definition
 */
export interface SectionDefinitionResult {
  /** The file containing the definition */
  file: string;
  /** Location of the section definition */
  location: Location;
  /** The entity name this section belongs to */
  entityName: string;
  /** The schema entry containing this section */
  schemaEntry: SchemaEntry;
}

/**
 * A reference to a section (instance entry with that section)
 */
export interface SectionReferenceLocation {
  /** The file containing the reference */
  file: string;
  /** Location of the entry with this section */
  location: Location;
  /** The instance entry with this section */
  entry: InstanceEntry;
}

/**
 * Result of finding section references
 */
export interface SectionReferencesResult {
  /** The section name */
  sectionName: string;
  /** The entity context (if known) */
  entityName: string | undefined;
  /** The definition (if it exists) */
  definition: SectionDefinitionResult | undefined;
  /** All instance entries with this section */
  references: SectionReferenceLocation[];
}

/**
 * Get section names from an instance entry
 */
function getEntrySections(entry: InstanceEntry): string[] {
  if (!entry.content) {
    return [];
  }
  return entry.content.children
    .filter((c) => c.type === "markdown_header")
    .map((h) => {
      // Extract section name from "# SectionName" format
      const match = h.text.match(/^#+\s*(.+)$/);
      return match ? match[1].trim() : h.text;
    });
}

/**
 * Find the section definition in a schema
 *
 * @param workspace - The workspace to search in
 * @param sectionName - The section name to find
 * @param entityName - Optional entity name to constrain the search
 * @returns The definition result, or undefined if not found
 */
export function findSectionDefinition(
  workspace: Workspace,
  sectionName: string,
  entityName?: string,
): SectionDefinitionResult | undefined {
  // If entityName is provided, look in that entity's schema
  if (entityName) {
    const schema = workspace.schemaRegistry.get(entityName);
    if (schema) {
      const section = schema.sections.get(sectionName);
      if (section) {
        // Find the schema entry that defines this section
        for (const model of workspace.allModels()) {
          for (const entry of model.ast.entries) {
            if (entry.type !== "schema_entry") {
              continue;
            }
            if (entry.header.entityName.value !== entityName) {
              continue;
            }

            const sectionDef = entry.sectionsBlock?.sections.find(
              (s) => s.name.value === sectionName,
            );
            if (sectionDef) {
              return {
                file: model.file,
                location: sectionDef.location,
                entityName,
                schemaEntry: entry,
              };
            }
          }
        }
      }
    }
    return undefined;
  }

  // Without entityName, search all schemas
  for (const schemaEntityName of workspace.schemaRegistry.entityNames()) {
    const result = findSectionDefinition(workspace, sectionName, schemaEntityName);
    if (result) {
      return result;
    }
  }

  return undefined;
}

/**
 * Find all references to a section
 *
 * @param workspace - The workspace to search in
 * @param sectionName - The section name to find references for
 * @param entityName - Optional entity name to constrain the search
 * @returns The references result
 */
export function findSectionReferences(
  workspace: Workspace,
  sectionName: string,
  entityName?: string,
): SectionReferencesResult {
  const definition = findSectionDefinition(workspace, sectionName, entityName);

  const references: SectionReferenceLocation[] = [];

  for (const model of workspace.allModels()) {
    for (const entry of model.ast.entries) {
      if (entry.type !== "instance_entry") {
        continue;
      }

      // If entityName is specified, only look at entries of that entity type
      if (entityName && entry.header.entity !== entityName) {
        continue;
      }

      if (getEntrySections(entry).includes(sectionName)) {
        references.push({
          file: model.file,
          location: entry.location,
          entry,
        });
      }
    }
  }

  return {
    sectionName,
    entityName,
    definition,
    references,
  };
}
