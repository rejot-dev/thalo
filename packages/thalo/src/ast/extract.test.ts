import { describe, it, expect } from "vitest";
import type { SyntaxNode } from "tree-sitter";
import { parseDocument } from "../parser.js";
import { extractTypeExpression } from "./extract.js";
import { isSyntaxError } from "./ast-types.js";

/** Recursively find a node of a given type in the tree */
function findNodeByType(node: SyntaxNode, type: string): SyntaxNode | null {
  if (node.type === type) {
    return node;
  }
  for (const child of node.namedChildren) {
    const found = findNodeByType(child, type);
    if (found) {
      return found;
    }
  }
  return null;
}

describe("extractTypeExpression", () => {
  it("returns syntax error for unknown type", () => {
    const source = `2026-01-07T11:40Z define-entity test "Test entity"
  # Metadata
  field: date-time ; "Field with unknown type"

  # Sections
  Notes ; "Some notes"
`;
    const { blocks } = parseDocument(source, { fileType: "thalo" });
    const tree = blocks[0].tree;

    // Find the type_expression node in the tree
    const typeExpr = findNodeByType(tree.rootNode, "type_expression");

    expect(typeExpr).toBeDefined();

    const result = extractTypeExpression(typeExpr!);

    expect(isSyntaxError(result)).toBe(true);
    if (isSyntaxError(result)) {
      expect(result.code).toBe("unknown_type");
      expect(result.message).toContain("date-time");
    }
  });

  it("extracts valid primitive type", () => {
    const source = `2026-01-07T11:40Z define-entity test "Test entity"
  # Metadata
  field: datetime ; "Field with valid type"

  # Sections
  Notes ; "Some notes"
`;
    const { blocks } = parseDocument(source, { fileType: "thalo" });
    const tree = blocks[0].tree;

    // Find the type_expression node in the tree
    const typeExpr = findNodeByType(tree.rootNode, "type_expression");

    expect(typeExpr).toBeDefined();

    const result = extractTypeExpression(typeExpr!);

    expect(isSyntaxError(result)).toBe(false);
    expect(result.type).toBe("primitive_type");
  });
});
