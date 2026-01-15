/**
 * Test utilities for creating mock AST nodes with proper types.
 * These helpers ensure test objects conform to the actual AST structure.
 */

import type { SyntaxNode, Point } from "tree-sitter";
import type {
  Location,
  InstanceEntry,
  InstanceHeader,
  Timestamp,
  Title,
  Link,
  Tag,
  Metadata,
  SchemaEntry,
  SchemaHeader,
  SynthesisEntry,
  SynthesisHeader,
  ActualizeEntry,
  ActualizeHeader,
  Identifier,
  Content,
  ContentLine,
  DatePart,
  TimePart,
  TimezonePart,
  Key,
  Value,
  ValueContent,
  QuotedValue,
  LinkValue,
} from "../ast/ast-types.js";

/**
 * Creates a mock Location object
 */
export function mockLocation(startIndex: number, endIndex: number): Location {
  const startPosition: Point = { row: 0, column: startIndex };
  const endPosition: Point = { row: 0, column: endIndex };
  return { startIndex, endIndex, startPosition, endPosition };
}

/**
 * Creates a mock SyntaxNode (minimal implementation for tests)
 */
export function mockSyntaxNode(): SyntaxNode {
  return {
    type: "mock",
    text: "",
    startIndex: 0,
    endIndex: 0,
    startPosition: { row: 0, column: 0 },
    endPosition: { row: 0, column: 0 },
  } as unknown as SyntaxNode;
}

/**
 * Creates a mock Timestamp
 */
export function mockTimestamp(value: string, startIndex = 0, endIndex = 17): Timestamp {
  // Parse timestamp to create date, time, timezone parts
  const dateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const timeMatch = value.match(/T(\d{2}):(\d{2})(?::(\d{2}))?/);
  const timezoneMatch = value.match(/([+-]\d{2}:\d{2}|Z)$/);

  const year = parseInt(dateMatch?.[1] || "2026", 10);
  const month = parseInt(dateMatch?.[2] || "01", 10);
  const day = parseInt(dateMatch?.[3] || "01", 10);
  const datePart: DatePart = {
    type: "date_part",
    year,
    month,
    day,
    value: `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day.toString().padStart(2, "0")}`,
    location: mockLocation(0, 10),
    syntaxNode: mockSyntaxNode(),
  };

  const hour = parseInt(timeMatch?.[1] || "00", 10);
  const minute = parseInt(timeMatch?.[2] || "00", 10);
  const timePart: TimePart = {
    type: "time_part",
    hour,
    minute,
    value: `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`,
    location: mockLocation(11, 16),
    syntaxNode: mockSyntaxNode(),
  };

  // Calculate offsetMinutes from timezone string
  const tzValue = timezoneMatch?.[1] || "Z";
  let offsetMinutes = 0;
  if (tzValue !== "Z") {
    const offsetMatch = tzValue.match(/([+-])(\d{2}):(\d{2})/);
    if (offsetMatch) {
      const sign = offsetMatch[1] === "+" ? 1 : -1;
      const hours = parseInt(offsetMatch[2], 10);
      const minutes = parseInt(offsetMatch[3], 10);
      offsetMinutes = sign * (hours * 60 + minutes);
    }
  }

  const timezonePart: TimezonePart = {
    type: "timezone_part",
    value: tzValue,
    offsetMinutes,
    location: mockLocation(16, 17),
    syntaxNode: mockSyntaxNode(),
  };

  return {
    type: "timestamp",
    value,
    date: datePart,
    time: timePart,
    timezone: timezonePart,
    location: mockLocation(startIndex, endIndex),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Creates a mock Title
 */
export function mockTitle(value: string, startIndex = 30, endIndex = 36): Title {
  return {
    type: "title",
    value,
    location: mockLocation(startIndex, endIndex),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Creates a mock Link
 */
export function mockLink(id: string, startIndex = 37, endIndex = 40): Link {
  return {
    type: "link",
    id,
    location: mockLocation(startIndex, endIndex),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Creates a mock Tag
 */
export function mockTag(name: string, startIndex = 41, endIndex = 46): Tag {
  return {
    type: "tag",
    name,
    location: mockLocation(startIndex, endIndex),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Creates a mock Identifier
 */
export function mockIdentifier(value: string, startIndex = 18, endIndex = 22): Identifier {
  return {
    type: "identifier",
    value,
    location: mockLocation(startIndex, endIndex),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Creates a mock Metadata
 */
export function mockMetadata(
  keyValue: string,
  rawValue: string,
  startIndex = 0,
  endIndex = 12,
): Metadata {
  const key: Key = {
    type: "key",
    value: keyValue,
    location: mockLocation(startIndex, startIndex + keyValue.length),
    syntaxNode: mockSyntaxNode(),
  };

  let content: ValueContent;
  if (rawValue.startsWith("^")) {
    const linkValue: LinkValue = {
      type: "link_value",
      link: mockLink(rawValue.slice(1), startIndex + keyValue.length + 2, endIndex),
      location: mockLocation(startIndex + keyValue.length + 2, endIndex),
      syntaxNode: mockSyntaxNode(),
    };
    content = linkValue;
  } else {
    const quotedValue: QuotedValue = {
      type: "quoted_value",
      value: rawValue.replace(/^"|"$/g, ""),
      location: mockLocation(startIndex + keyValue.length + 2, endIndex),
      syntaxNode: mockSyntaxNode(),
    };
    content = quotedValue;
  }

  const value: Value = {
    type: "value",
    raw: rawValue,
    content,
    location: mockLocation(startIndex + keyValue.length + 2, endIndex),
    syntaxNode: mockSyntaxNode(),
  };

  return {
    type: "metadata",
    key,
    value,
    location: mockLocation(startIndex, endIndex),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Creates a mock Content
 */
export function mockContent(lines: string[], startIndex = 0, endIndex = 13): Content {
  return {
    type: "content",
    children: lines.map(
      (text, i): ContentLine => ({
        type: "content_line",
        text,
        location: mockLocation(startIndex + i * 7, startIndex + i * 7 + text.length),
        syntaxNode: mockSyntaxNode(),
      }),
    ),
    location: mockLocation(startIndex, endIndex),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Creates a mock InstanceHeader
 */
export function mockInstanceHeader(options: {
  timestamp: string;
  directive: "create" | "update";
  entity: "lore" | "opinion" | "reference" | "journal";
  title: string;
  linkId?: string;
  tags?: string[];
  startIndex?: number;
  endIndex?: number;
}): InstanceHeader {
  const {
    timestamp,
    directive,
    entity,
    title,
    linkId,
    tags = [],
    startIndex = 0,
    endIndex = 40,
  } = options;

  return {
    type: "instance_header",
    timestamp: mockTimestamp(timestamp),
    directive,
    entity,
    title: mockTitle(title),
    link: linkId ? mockLink(linkId) : null,
    tags: tags.map((name) => mockTag(name)),
    location: mockLocation(startIndex, endIndex),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Creates a mock InstanceEntry
 */
export function mockInstanceEntry(options: {
  timestamp: string;
  directive: "create" | "update";
  entity: "lore" | "opinion" | "reference" | "journal";
  title: string;
  linkId?: string;
  tags?: string[];
  metadata?: Array<{ key: string; value: string }>;
  content?: string[];
  startIndex?: number;
  endIndex?: number;
}): InstanceEntry {
  const { metadata = [], content, startIndex = 0, endIndex = 40 } = options;

  return {
    type: "instance_entry",
    header: mockInstanceHeader(options),
    metadata: metadata.map((m, i) => mockMetadata(m.key, m.value, i * 15, i * 15 + 12)),
    content: content ? mockContent(content) : null,
    location: mockLocation(startIndex, endIndex),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Creates a mock SchemaHeader
 */
export function mockSchemaHeader(options: {
  timestamp: string;
  directive: "define-entity" | "alter-entity";
  entityName: string;
  title: string;
  linkId?: string;
  tags?: string[];
  startIndex?: number;
  endIndex?: number;
}): SchemaHeader {
  const {
    timestamp,
    directive,
    entityName,
    title,
    linkId,
    tags = [],
    startIndex = 0,
    endIndex = 40,
  } = options;

  return {
    type: "schema_header",
    timestamp: mockTimestamp(timestamp),
    directive,
    entityName: mockIdentifier(entityName),
    title: mockTitle(title),
    link: linkId ? mockLink(linkId) : null,
    tags: tags.map((name) => mockTag(name)),
    location: mockLocation(startIndex, endIndex),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Creates a mock SchemaEntry
 */
export function mockSchemaEntry(options: {
  timestamp: string;
  directive: "define-entity" | "alter-entity";
  entityName: string;
  title: string;
  linkId?: string;
  tags?: string[];
  startIndex?: number;
  endIndex?: number;
}): SchemaEntry {
  const { startIndex = 0, endIndex = 40 } = options;

  return {
    type: "schema_entry",
    header: mockSchemaHeader(options),
    metadataBlock: null,
    sectionsBlock: null,
    removeMetadataBlock: null,
    removeSectionsBlock: null,
    location: mockLocation(startIndex, endIndex),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Creates a mock SynthesisHeader
 */
export function mockSynthesisHeader(options: {
  timestamp: string;
  title: string;
  linkId: string;
  tags?: string[];
  startIndex?: number;
  endIndex?: number;
}): SynthesisHeader {
  const { timestamp, title, linkId, tags = [], startIndex = 0, endIndex = 56 } = options;

  return {
    type: "synthesis_header",
    timestamp: mockTimestamp(timestamp),
    title: mockTitle(title),
    linkId: mockLink(linkId),
    tags: tags.map((name) => mockTag(name)),
    location: mockLocation(startIndex, endIndex),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Creates a mock SynthesisEntry
 */
export function mockSynthesisEntry(options: {
  timestamp: string;
  title: string;
  linkId: string;
  tags?: string[];
  metadata?: Array<{ key: string; value: string }>;
  content?: string[];
  startIndex?: number;
  endIndex?: number;
}): SynthesisEntry {
  const { metadata = [], content, startIndex = 0, endIndex = 56 } = options;

  return {
    type: "synthesis_entry",
    header: mockSynthesisHeader(options),
    metadata: metadata.map((m, i) => mockMetadata(m.key, m.value, i * 15, i * 15 + 12)),
    content: content ? mockContent(content) : null,
    location: mockLocation(startIndex, endIndex),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Creates a mock ActualizeHeader
 */
export function mockActualizeHeader(options: {
  timestamp: string;
  target: string;
  startIndex?: number;
  endIndex?: number;
}): ActualizeHeader {
  const { timestamp, target, startIndex = 0, endIndex = 49 } = options;

  return {
    type: "actualize_header",
    timestamp: mockTimestamp(timestamp),
    target: mockLink(target),
    location: mockLocation(startIndex, endIndex),
    syntaxNode: mockSyntaxNode(),
  };
}

/**
 * Creates a mock ActualizeEntry
 */
export function mockActualizeEntry(options: {
  timestamp: string;
  target: string;
  metadata?: Array<{ key: string; value: string }>;
  startIndex?: number;
  endIndex?: number;
}): ActualizeEntry {
  const { metadata = [], startIndex = 0, endIndex = 49 } = options;

  return {
    type: "actualize_entry",
    header: mockActualizeHeader(options),
    metadata: metadata.map((m, i) => mockMetadata(m.key, m.value, i * 15, i * 15 + 12)),
    location: mockLocation(startIndex, endIndex),
    syntaxNode: mockSyntaxNode(),
  };
}
