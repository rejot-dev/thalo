/**
 * Client-side Thalo syntax highlighting provider.
 *
 * This component runs on the client and highlights all code blocks
 * containing Thalo syntax using tree-sitter WASM.
 *
 * Since Shiki/Fumadocs completely replaces the pre element structure
 * and doesn't preserve our data attributes, we detect thalo blocks
 * by their content pattern instead.
 */

import { useEffect } from "react";
import { getParser } from "@/lib/thalo-parser.client";
import { highlightToTokens } from "@/lib/thalo-highlighter";

/**
 * Pattern to detect Thalo code blocks.
 * Matches:
 * - ISO timestamp entries: 2026-01-08T14:30Z create/alter/define-entity/define-synthesis
 * - Comments at start: // ...
 */
const THALO_PATTERNS = [
  // ISO timestamp followed by thalo command
  /^\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\s+(create|alter|define-entity|define-synthesis)\s/m,
  // Comment followed by thalo command on next line
  /^\s*\/\/.*\n\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z\s+(create|alter|define-entity|define-synthesis)\s/m,
];

/**
 * Check if code content looks like Thalo syntax.
 */
function isThaloCode(code: string): boolean {
  return THALO_PATTERNS.some((pattern) => pattern.test(code));
}

/**
 * Provider component that highlights all thalo code blocks on mount.
 */
export function ThaloHighlightProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Find all pre > code elements
    const allPre = document.querySelectorAll<HTMLElement>("pre");

    // Find thalo code blocks by content pattern
    const thaloCodeBlocks: HTMLElement[] = [];
    allPre.forEach((pre) => {
      const code = pre.querySelector<HTMLElement>("code");
      if (code && isThaloCode(code.textContent || "")) {
        thaloCodeBlocks.push(code);
      }
    });

    if (thaloCodeBlocks.length === 0) {
      return;
    }

    // Get parser and highlight all blocks
    getParser()
      .then((parser) => {
        for (const codeElement of thaloCodeBlocks) {
          const code = codeElement.textContent || "";
          try {
            const { lines } = highlightToTokens(parser, code);

            // Build highlighted HTML using inline styles
            const html = lines
              .map((line) => {
                const spans = line.tokens
                  .map((token) => {
                    const escaped = token.text
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;");
                    if (token.style) {
                      return `<span style="${token.style}">${escaped}</span>`;
                    }
                    return escaped;
                  })
                  .join("");
                return `<span class="line">${spans}</span>`;
              })
              .join("\n");

            // Update the code element
            codeElement.innerHTML = html;
            codeElement.classList.add("thalo-highlighted");

            // Mark parent pre as highlighted for styling
            const parentPre = codeElement.closest("pre");
            if (parentPre) {
              parentPre.setAttribute("data-thalo-highlighted", "true");
            }
          } catch (err) {
            // eslint-disable-next-line no-console
            console.error("[thalo-highlight] Failed to highlight code block:", err);
          }
        }
      })
      .catch((err) => {
        // eslint-disable-next-line no-console
        console.error("[thalo-highlight] Error loading parser:", err);
      });
  }, []);

  return <>{children}</>;
}
