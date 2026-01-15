import type { CompletionProvider } from "../completions.js";
import { timestampProvider } from "./timestamp.js";
import { directiveProvider } from "./directive.js";
import { entityProvider } from "./entity.js";
import { metadataKeyProvider } from "./metadata-key.js";
import { metadataValueProvider } from "./metadata-value.js";
import { linkProvider } from "./link.js";
import { tagProvider } from "./tag.js";
import { sectionProvider } from "./section.js";
import { schemaBlockProvider } from "./schema-block.js";
import { typeExprProvider } from "./type-expr.js";

/**
 * All completion providers, in order of priority.
 */
export const allProviders: readonly CompletionProvider[] = [
  timestampProvider,
  directiveProvider,
  entityProvider,
  metadataKeyProvider,
  metadataValueProvider,
  linkProvider,
  tagProvider,
  sectionProvider,
  schemaBlockProvider,
  typeExprProvider,
];

// Re-export individual providers for testing
export {
  timestampProvider,
  directiveProvider,
  entityProvider,
  metadataKeyProvider,
  metadataValueProvider,
  linkProvider,
  tagProvider,
  sectionProvider,
  schemaBlockProvider,
  typeExprProvider,
};
