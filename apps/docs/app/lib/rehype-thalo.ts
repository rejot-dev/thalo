/**
 * Rehype plugin for Thalo syntax highlighting.
 *
 * This plugin marks thalo code blocks with special classes and data attributes
 * so they can be highlighted client-side using tree-sitter WASM.
 *
 * Server-side (async) highlighting has issues with fumadocs-mdx not properly
 * awaiting async rehype plugins, so we defer actual highlighting to the client.
 */

import type { Root, Element } from "hast";
import { visit } from "unist-util-visit";

/**
 * Rehype plugin that marks Thalo code blocks for client-side highlighting.
 *
 * Adds data-language="thalo" to the parent <pre> element and changes
 * language-thalo to language-text (to prevent Shiki errors).
 */
export function rehypeThalo() {
  return function transform(tree: Root): void {
    // Find pre > code elements with language-thalo
    visit(tree, "element", (node: Element, _index, parent) => {
      if (node.tagName !== "code") {
        return;
      }

      const className = node.properties?.className;
      if (!className) {
        return;
      }

      const classArray = Array.isArray(className) ? className : [className];
      const classes = classArray.filter((c): c is string => typeof c === "string");
      const hasThalo = classes.some((c) => c === "language-thalo" || c === "lang-thalo");

      if (hasThalo) {
        // Replace language-thalo with language-text to prevent Shiki errors
        const newClasses = classes.map((c) => {
          if (c === "language-thalo") {
            return "language-text";
          }
          if (c === "lang-thalo") {
            return "lang-text";
          }
          return c;
        });

        node.properties = {
          ...node.properties,
          className: newClasses,
        };

        // Add data-language to the parent pre element (which Shiki might preserve)
        if (parent && (parent as Element).tagName === "pre") {
          const preElement = parent as Element;
          preElement.properties = {
            ...preElement.properties,
            "data-language": "thalo",
          };
        }
      }
    });
  };
}

export default rehypeThalo;
