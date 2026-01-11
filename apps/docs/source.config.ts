import {
  defineCollections,
  defineConfig,
  defineDocs,
  frontmatterSchema,
  metaSchema,
} from "fumadocs-mdx/config";
import { z } from "zod";
import { rehypeThalo } from "./app/lib/rehype-thalo";

// You can customise Zod schemas for frontmatter and `meta.json` here
// see https://fumadocs.dev/docs/mdx/collections#define-docs
export const docs = defineDocs({
  docs: {
    schema: frontmatterSchema,
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
  meta: {
    schema: metaSchema,
  },
});

export const blog = defineCollections({
  type: "doc",
  dir: "content/blog",
  schema: frontmatterSchema.extend({
    author: z.string(),
    date: z.coerce.date(),
    image: z.string().optional(),
  }),
});

export default defineConfig({
  mdxOptions: {
    // rehypeThalo runs before Shiki and rewrites language-thalo/lang-thalo classes
    // to language-text/lang-text (so Shiki doesn't error on unknown language),
    // while adding data-language="thalo" to the parent <pre> for client highlighting.
    rehypePlugins: (plugins) => [rehypeThalo, ...plugins],
  },
});
