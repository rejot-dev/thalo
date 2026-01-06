import type { Workspace } from "../model/workspace.js";
import type { Location } from "../ast/types.js";
import type { ModelSchemaEntry, ModelInstanceEntry, ModelEntry } from "../model/types.js";

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
  entry: ModelSchemaEntry;
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
  entry: ModelInstanceEntry;
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
  // Look for define-entity entry with this name
  for (const entry of workspace.allSchemaEntries()) {
    if (entry.directive === "define-entity" && entry.entityName === entityName) {
      return {
        file: entry.file,
        location: entry.location,
        entry,
      };
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
  for (const entry of workspace.allInstanceEntries()) {
    if (entry.entity === entityName) {
      references.push({
        file: entry.file,
        location: entry.location,
        entry,
        isDefinition: false,
      });
    }
  }

  // Also find alter-entity entries that reference this entity
  for (const entry of workspace.allSchemaEntries()) {
    if (entry.directive === "alter-entity" && entry.entityName === entityName) {
      references.push({
        file: entry.file,
        location: entry.location,
        entry: entry as unknown as ModelInstanceEntry, // Type cast for location purposes
        isDefinition: false,
      });
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
  entry: ModelEntry;
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
 * Find all entries with a given tag
 *
 * @param workspace - The workspace to search in
 * @param tagName - The tag name (without # prefix)
 * @returns The references result
 */
export function findTagReferences(workspace: Workspace, tagName: string): TagReferencesResult {
  const references: TagReferenceLocation[] = [];

  for (const entry of workspace.allEntries()) {
    if (entry.tags.includes(tagName)) {
      references.push({
        file: entry.file,
        location: entry.location,
        entry,
      });
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
  schemaEntry: ModelSchemaEntry;
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
  entry: ModelInstanceEntry;
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
        for (const entry of workspace.allSchemaEntries()) {
          if (entry.entityName === entityName) {
            const fieldDef = entry.fields.find((f) => f.name === fieldName);
            if (fieldDef) {
              return {
                file: entry.file,
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
  for (const entry of workspace.allInstanceEntries()) {
    // If entityName is specified, only look at entries of that entity type
    if (entityName && entry.entity !== entityName) {
      continue;
    }

    const metadataValue = entry.metadata.get(fieldName);
    if (metadataValue) {
      references.push({
        file: entry.file,
        location: metadataValue.location,
        entry,
      });
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
  schemaEntry: ModelSchemaEntry;
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
  entry: ModelInstanceEntry;
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
        for (const entry of workspace.allSchemaEntries()) {
          if (entry.entityName === entityName) {
            const sectionDef = entry.sections.find((s) => s.name === sectionName);
            if (sectionDef) {
              return {
                file: entry.file,
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
  for (const entry of workspace.allInstanceEntries()) {
    // If entityName is specified, only look at entries of that entity type
    if (entityName && entry.entity !== entityName) {
      continue;
    }

    if (entry.sections.includes(sectionName)) {
      references.push({
        file: entry.file,
        location: entry.location,
        entry,
      });
    }
  }

  return {
    sectionName,
    entityName,
    definition,
    references,
  };
}
