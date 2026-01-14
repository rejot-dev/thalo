import type { Rule, RuleCategory } from "../types.js";
import type { RuleVisitor } from "../visitor.js";
import type { Query as AstQuery } from "../../ast/types.js";

const category: RuleCategory = "instance";

const visitor: RuleVisitor = {
  visitSynthesisEntry(entry, ctx) {
    const sourcesMeta = entry.metadata.find((m) => m.key.value === "sources");
    if (!sourcesMeta) {
      // Missing sources is handled by synthesis-missing-sources rule
      return;
    }

    const content = sourcesMeta.value.content;
    const queries: AstQuery[] = [];

    // Extract queries from sources (single query or array)
    if (content.type === "query_value") {
      queries.push(content.query);
    } else if (content.type === "value_array") {
      for (const elem of content.elements) {
        if (elem.type === "query") {
          queries.push(elem);
        }
      }
    }

    // Check each query's entity against the schema registry
    const registry = ctx.workspace.schemaRegistry;
    for (const query of queries) {
      if (!registry.has(query.entity)) {
        ctx.report({
          message: `Unknown entity type '${query.entity}' in synthesis query. Define it using 'define-entity ${query.entity}'.`,
          file: ctx.file,
          location: query.location,
          sourceMap: ctx.sourceMap,
          data: { entity: query.entity },
        });
      }
    }
  },
};

/**
 * Check that synthesis source queries reference defined entity types
 */
export const synthesisUnknownQueryEntityRule: Rule = {
  code: "synthesis-unknown-query-entity",
  name: "Synthesis Unknown Query Entity",
  description: "A synthesis source query must reference a defined entity type",
  category,
  defaultSeverity: "error",
  dependencies: { scope: "entry", schemas: true },
  visitor,
};
