import type { SyntaxNode, Tree } from "tree-sitter";
import { parsePtall } from "./parser.js";

/**
 * Supported fragment types for parsing individual expressions.
 */
export type FragmentType = "query" | "value" | "type_expression";

/**
 * Result of parsing a fragment
 */
export interface ParsedFragment {
  /** The parsed syntax node */
  node: SyntaxNode;
  /** Whether the fragment parsed without errors */
  valid: boolean;
  /** Error message if parsing failed */
  error?: string;
}

/**
 * Wrapper templates for embedding fragments in valid document context.
 * Each template specifies:
 * - wrapper: The document template with {FRAGMENT} placeholder
 * - find: Function to locate the fragment node in the parsed tree
 */
const FRAGMENT_WRAPPERS: Record<
  FragmentType,
  {
    wrapper: string;
    find: (tree: Tree) => SyntaxNode | null;
  }
> = {
  // Queries are embedded as metadata values in an instance entry
  query: {
    wrapper: `2000-01-01T00:00 create lore "x"
  sources: {FRAGMENT}`,
    find: (tree) => {
      // Navigate: source_file > entry > instance_entry > metadata > value > query
      const entry = tree.rootNode.namedChildren.find((c) => c.type === "entry");
      const instanceEntry = entry?.namedChildren.find((c) => c.type === "instance_entry");
      const metadata = instanceEntry?.namedChildren.find((c) => c.type === "metadata");
      const value = metadata?.childForFieldName("value");
      return value?.namedChildren.find((c) => c.type === "query") ?? null;
    },
  },

  // Generic values are embedded as metadata values
  value: {
    wrapper: `2000-01-01T00:00 create lore "x"
  key: {FRAGMENT}`,
    find: (tree) => {
      const entry = tree.rootNode.namedChildren.find((c) => c.type === "entry");
      const instanceEntry = entry?.namedChildren.find((c) => c.type === "instance_entry");
      const metadata = instanceEntry?.namedChildren.find((c) => c.type === "metadata");
      return metadata?.childForFieldName("value") ?? null;
    },
  },

  // Type expressions are embedded in a schema field definition
  type_expression: {
    wrapper: `2000-01-01T00:00 define-entity test "x"
  # Metadata
  field: {FRAGMENT}`,
    find: (tree) => {
      // Navigate: source_file > entry > schema_entry > metadata_block > field_definition > type
      const entry = tree.rootNode.namedChildren.find((c) => c.type === "entry");
      const schemaEntry = entry?.namedChildren.find((c) => c.type === "schema_entry");
      const metadataBlock = schemaEntry?.namedChildren.find((c) => c.type === "metadata_block");
      const fieldDef = metadataBlock?.namedChildren.find((c) => c.type === "field_definition");
      return fieldDef?.childForFieldName("type") ?? null;
    },
  },
};

/**
 * Parse a fragment of ptall source as a specific expression type.
 *
 * Since tree-sitter always parses from the root grammar rule, this function
 * embeds the fragment in a minimal valid document context, parses it, and
 * extracts the relevant syntax node.
 *
 * @example
 * ```ts
 * // Parse a query expression
 * const result = parseFragment('query', 'lore where type = "fact" and #education');
 * if (result.valid) {
 *   console.log(result.node.type); // "query"
 * }
 *
 * // Parse a type expression
 * const typeResult = parseFragment('type_expression', 'string | "literal"');
 * ```
 *
 * @param type - The type of fragment to parse
 * @param source - The source string to parse as that fragment type
 * @returns ParsedFragment with the syntax node and validity status
 */
export function parseFragment(type: FragmentType, source: string): ParsedFragment {
  const config = FRAGMENT_WRAPPERS[type];
  if (!config) {
    return {
      node: null as unknown as SyntaxNode,
      valid: false,
      error: `Unknown fragment type: ${type}`,
    };
  }

  // Embed fragment in wrapper template
  const wrappedSource = config.wrapper.replace("{FRAGMENT}", source);
  const tree = parsePtall(wrappedSource);

  // Check for parse errors in the whole tree
  if (tree.rootNode.hasError) {
    // Try to find the fragment node anyway for partial results
    const node = config.find(tree);
    if (node) {
      return {
        node,
        valid: !node.hasError,
        error: node.hasError ? "Parse error in fragment" : undefined,
      };
    }
    return {
      node: tree.rootNode,
      valid: false,
      error: "Parse error: could not locate fragment in parsed tree",
    };
  }

  // Find the fragment node
  const node = config.find(tree);
  if (!node) {
    return {
      node: tree.rootNode,
      valid: false,
      error: "Could not locate fragment in parsed tree",
    };
  }

  return {
    node,
    valid: !node.hasError,
    error: node.hasError ? "Parse error in fragment" : undefined,
  };
}

/**
 * Parse a query expression.
 * Convenience wrapper around parseFragment('query', source).
 *
 * @example
 * ```ts
 * const result = parseQuery('lore where type = "fact" and #education');
 * if (result.valid) {
 *   // result.node.type === "query"
 *   // Access entity: result.node.childForFieldName('entity')
 *   // Access conditions: result.node.childForFieldName('conditions')
 * }
 * ```
 */
export function parseQuery(source: string): ParsedFragment {
  return parseFragment("query", source);
}
