/**
 * Blog components for interactive Thalo code examples.
 *
 * Single-file usage (legacy):
 * ```mdx
 * <BlogCodeProvider defaultCode={`2026-01-08 create opinion "Example" ^example`}>
 *   <BlogCode title="Example" filename="example.thalo" />
 *   <BlogChecker />
 * </BlogCodeProvider>
 * ```
 *
 * Multi-file usage with tabs:
 * ```mdx
 * <BlogCodeProvider files={[
 *   { id: "entities", name: "Entities", filename: "entities.thalo", content: "...", icon: "entities" },
 *   { id: "entries", name: "Entries", filename: "entries.thalo", content: "...", icon: "entries" },
 * ]}>
 *   <BlogCode />
 *   <BlogChecker />
 * </BlogCodeProvider>
 * ```
 */

export {
  BlogCodeProvider,
  BlogCode,
  useBlogCode,
  type BlogCodeProps,
  type BlogFile,
} from "./blog-code";
export { BlogChecker, type BlogCheckerProps } from "./blog-checker";
export { WorkflowLoopStatic } from "./workflow-loop-static";
