import { describe, it, expect, beforeEach, vi } from "vitest";

describe("Node Parser (native with WASM fallback)", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("throws if createParser is called before initParser", async () => {
    const { createParser, isInitialized } = await import("./parser.node.js");

    expect(isInitialized()).toBe(false);
    expect(() => createParser()).toThrow(/initParser/);
  });

  it("initializes and parses a document", async () => {
    const { initParser, createWorkspace, isInitialized } = await import("./parser.node.js");

    await initParser();
    expect(isInitialized()).toBe(true);

    const workspace = createWorkspace();
    workspace.addDocument(`2026-01-01T00:00Z create lore "Test entry"`, {
      filename: "test.thalo",
    });

    expect(workspace.getModel("test.thalo")).toBeDefined();
  });

  it("falls back to WASM when native bindings are unavailable", async () => {
    vi.doMock("tree-sitter", () => {
      throw new Error("native bindings unavailable");
    });

    const { initParser, isUsingNative, createWorkspace } = await import("./parser.node.js");

    await initParser();
    expect(isUsingNative()).toBe(false);

    const workspace = createWorkspace();
    workspace.addDocument(`2026-01-01T00:00Z create lore "Fallback test"`, {
      filename: "fallback.thalo",
    });

    expect(workspace.getModel("fallback.thalo")).toBeDefined();
  });
});
