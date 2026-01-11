/**
 * Thalo code rendering component.
 *
 * Renders pre-highlighted Thalo code lines. Use with loader/clientLoader
 * to get highlighted lines from the server or client parser.
 *
 * Usage:
 * ```tsx
 * // In your route:
 * export async function loader() {
 *   const parser = await getParser();
 *   const { lines } = highlightToTokens(parser, code);
 *   return { highlightedLines: lines };
 * }
 *
 * // In your component:
 * const { highlightedLines } = useLoaderData<typeof loader>();
 * <ThaloCodeRenderer lines={highlightedLines} />
 * ```
 */

import { cn } from "@/lib/cn";
import type { HighlightedLine } from "@/lib/thalo-highlighter";

// Re-export for convenience
export type { HighlightedLine };

/**
 * Props for ThaloCodeRenderer component.
 */
export interface ThaloCodeRendererProps {
  /** Pre-highlighted lines from highlightToTokens() */
  lines: HighlightedLine[];
  /** Additional CSS classes for the pre element */
  className?: string;
}

/**
 * Render pre-highlighted Thalo code lines.
 *
 * This is a pure render component - it doesn't do any parsing or highlighting.
 * Use highlightToTokens() in a loader to get the lines.
 */
export function ThaloCodeRenderer({ lines, className }: ThaloCodeRendererProps) {
  return (
    <pre className={cn("overflow-x-auto p-4 text-sm leading-relaxed", className)}>
      <code className="block w-fit min-w-full font-mono">
        {lines.map((line, lineIdx) => (
          <span key={lineIdx} className="line">
            {line.tokens.map((token, tokenIdx) =>
              token.style ? (
                <span key={tokenIdx} style={{ color: token.style.replace("color: ", "") }}>
                  {token.text}
                </span>
              ) : (
                token.text
              ),
            )}
            {lineIdx < lines.length - 1 && "\n"}
          </span>
        ))}
      </code>
    </pre>
  );
}
