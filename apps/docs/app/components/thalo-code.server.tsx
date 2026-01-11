import { ThaloCodeRenderer, type HighlightedLine } from "./thalo-code";
import { getParser } from "@/lib/thalo-parser.server";
import { highlightToTokens } from "@/lib/thalo-highlighter";

/**
 * ThaloCode - Server-side rendered Thalo code highlighter.
 *
 * This is an async server component that highlights Thalo code during SSR
 * using tree-sitter WASM. No client-side JavaScript required for highlighting.
 *
 * ⚠️ SERVER-ONLY: This component can only be used in loaders or other server contexts.
 * For route components, use the loader pattern with ThaloCodeRenderer.
 */
export async function ThaloCode({ code, className }: { code: string; className?: string }) {
  let lines: HighlightedLine[];
  try {
    const parser = await getParser();
    lines = highlightToTokens(parser, code).lines;
  } catch {
    // Fallback to raw code if parsing fails
    lines = [{ tokens: [{ text: code, style: null }] }];
  }

  return <ThaloCodeRenderer lines={lines} className={className} />;
}
