/**
 * Regression test: Main @rejot-dev/thalo export doesn't statically import native tree-sitter.
 *
 * This prevents regressions where a module accidentally imports from parser.js or parser.native.js,
 * which would cause the entire package to fail at IMPORT time on systems without native bindings.
 *
 * The issue: If any module in the import chain has a static import of tree-sitter or
 * @rejot-dev/tree-sitter-thalo, the module will fail to load before any try-catch can run.
 *
 * The fix: All imports of tree-sitter must be dynamic (await import(...)) and wrapped in try-catch,
 * so the WASM fallback can kick in when native bindings aren't available.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Main export doesn't require native tree-sitter at import time", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("@rejot-dev/thalo can be imported when native tree-sitter is unavailable", async () => {
    // Mock tree-sitter to throw (simulating no native bindings)
    // This simulates what happens on a system where:
    // - pnpm install ignored build scripts
    // - OR there are no prebuilt binaries for the platform
    vi.doMock("tree-sitter", () => {
      throw new Error("No native build was found for platform=test");
    });

    vi.doMock("@rejot-dev/tree-sitter-thalo", () => {
      throw new Error("No native build was found for platform=test");
    });

    // The main export should be importable without throwing
    // If this throws, it means something in the import chain has a static import of tree-sitter
    const mod = await import("./mod.js");

    // Verify we got the expected exports
    expect(mod.Workspace).toBeDefined();
    expect(mod.runCheck).toBeDefined();
    expect(mod.runFormat).toBeDefined();
    expect(mod.mergeThaloFiles).toBeDefined();
    expect(mod.checkDocument).toBeDefined();
    expect(mod.allRules).toBeDefined();
    expect(mod.TypeExpr).toBeDefined();
  });

  it("@rejot-dev/thalo/node can be imported when native tree-sitter is unavailable", async () => {
    vi.doMock("tree-sitter", () => {
      throw new Error("No native build was found for platform=test");
    });

    vi.doMock("@rejot-dev/tree-sitter-thalo", () => {
      throw new Error("No native build was found for platform=test");
    });

    // The node export should be importable - it only loads tree-sitter when initParser() is called
    const mod = await import("./parser.node.js");

    expect(mod.initParser).toBeDefined();
    expect(mod.createWorkspace).toBeDefined();
    expect(mod.createParser).toBeDefined();
    expect(mod.parseDocument).toBeDefined();
    expect(mod.isInitialized).toBeDefined();
    expect(mod.isUsingNative).toBeDefined();
  });
});
