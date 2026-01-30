# Thalo Scripting API

The scripting API provides programmatic access to Thalo workspaces so you can query entries, inspect
links, run checks, and build custom tooling.

## Installation

The API ships with `@rejot-dev/thalo`:

```bash
npm install @rejot-dev/thalo
# or
pnpm add @rejot-dev/thalo
# or
yarn add @rejot-dev/thalo
```

## Quick start

```typescript
import { loadThalo } from "@rejot-dev/thalo/api";

const workspace = await loadThalo("./my-knowledge-base");

for (const entry of workspace.entries()) {
  console.log(`${entry.timestamp} - ${entry.title}`);
}

const codingOpinions = workspace.query("opinion where #coding");
const refs = workspace.findReferences("^my-important-note");
```

## Loading a workspace

```typescript
import { loadThalo, loadThaloFiles } from "@rejot-dev/thalo/api";

// From a directory
const workspace = await loadThalo("./my-knowledge-base");

// Only .thalo files
const thaloOnly = await loadThalo("./kb", { extensions: [".thalo"] });

// From specific files
const fromFiles = await loadThaloFiles(["./entries.thalo", "./syntheses.thalo"]);
```

## Iterating entries

```typescript
const instances = workspace.instanceEntries();
const schemas = workspace.schemaEntries();
const syntheses = workspace.synthesisEntries();
const actualizations = workspace.actualizeEntries();
```

## Navigation

```typescript
// Find where ^my-note is defined
const def = workspace.findDefinition("^my-note");

// Find all references to a link
const linkRefs = workspace.findReferences("^my-note");

// Find all entries with a tag
const tagRefs = workspace.findReferences("#coding");
```

Note: the `^` or `#` prefix is required.

## Querying

```typescript
workspace.query("opinion");
workspace.query('opinion where confidence = "high"');
workspace.query("opinion, lore");
```

## Filtering by checkpoint

```typescript
import { createChangeTracker } from "@rejot-dev/thalo/change-tracker/node";

const sinceTimestamp = await workspace.filteredSince("ts:2026-01-10T15:00Z");

const tracker = await createChangeTracker();
const sinceGit = await workspace.filteredSince("git:abc123def456", { tracker });
```

## Watching for changes (Node.js only)

```typescript
const controller = new AbortController();
const changes = workspace.watch({ includeExisting: true, signal: controller.signal });

for await (const change of changes) {
  for (const entry of change.added) console.log(`Added: ${entry.title}`);
  for (const entry of change.updated) console.log(`Updated: ${entry.title}`);
  for (const entry of change.removed) console.log(`Removed: ${entry.title}`);
}

controller.abort();
```

## Validation

```typescript
const diagnostics = workspace.check();

const diagnosticsWithRules = workspace.check({
  rules: {
    "unknown-entity": "error",
    "missing-title": "warning",
    "empty-section": "off",
  },
});
```

## Visitors

```typescript
const counts = new Map<string, number>();

workspace.visit({
  visitInstanceEntry(entry) {
    counts.set(entry.entity, (counts.get(entry.entity) ?? 0) + 1);
  },
});
```

## Example scripts

- Export to JSON
- Find orphaned links
- Tag statistics
- Custom validation rules

See `apps/docs/content/docs/scripting.mdx` for the full examples and type details.
