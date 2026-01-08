import { describe, it, expect } from "vitest";
import { serverCapabilities, tokenLegend, thaloFileFilters } from "./capabilities.js";

describe("thalo-lsp", () => {
  describe("serverCapabilities", () => {
    it("should enable definition provider", () => {
      expect(serverCapabilities.definitionProvider).toBe(true);
    });

    it("should enable references provider", () => {
      expect(serverCapabilities.referencesProvider).toBe(true);
    });

    it("should enable hover provider", () => {
      expect(serverCapabilities.hoverProvider).toBe(true);
    });

    it("should enable completion provider", () => {
      expect(serverCapabilities.completionProvider).toBeDefined();
      const provider = serverCapabilities.completionProvider as {
        triggerCharacters: string[];
        resolveProvider: boolean;
      };
      expect(provider.triggerCharacters).toContain("^");
      expect(provider.triggerCharacters).toContain("#");
      expect(provider.resolveProvider).toBe(true);
    });

    it("should enable semantic tokens provider", () => {
      expect(serverCapabilities.semanticTokensProvider).toBeDefined();
      const provider = serverCapabilities.semanticTokensProvider as {
        full: boolean;
        range: boolean;
        legend: typeof tokenLegend;
      };
      expect(provider.full).toBe(true);
      expect(provider.range).toBe(false);
    });

    it("should enable file operations for thalo and markdown files", () => {
      expect(serverCapabilities.workspace).toBeDefined();
      const workspace = serverCapabilities.workspace as {
        fileOperations: {
          didCreate: { filters: typeof thaloFileFilters };
          didDelete: { filters: typeof thaloFileFilters };
          didRename: { filters: typeof thaloFileFilters };
        };
      };

      expect(workspace.fileOperations).toBeDefined();
      expect(workspace.fileOperations.didCreate).toBeDefined();
      expect(workspace.fileOperations.didDelete).toBeDefined();
      expect(workspace.fileOperations.didRename).toBeDefined();

      // Check that filters include thalo and md files
      expect(workspace.fileOperations.didCreate.filters).toEqual(thaloFileFilters);
      expect(workspace.fileOperations.didDelete.filters).toEqual(thaloFileFilters);
      expect(workspace.fileOperations.didRename.filters).toEqual(thaloFileFilters);
    });
  });

  describe("thaloFileFilters", () => {
    it("should include thalo file filter", () => {
      const thaloFilter = thaloFileFilters.find((f) => f.pattern.glob === "**/*.thalo");
      expect(thaloFilter).toBeDefined();
      expect(thaloFilter?.scheme).toBe("file");
    });

    it("should include markdown file filter", () => {
      const mdFilter = thaloFileFilters.find((f) => f.pattern.glob === "**/*.md");
      expect(mdFilter).toBeDefined();
      expect(mdFilter?.scheme).toBe("file");
    });
  });

  describe("tokenLegend", () => {
    it("should define token types", () => {
      expect(tokenLegend.tokenTypes).toContain("namespace");
      expect(tokenLegend.tokenTypes).toContain("function");
      expect(tokenLegend.tokenTypes).toContain("variable");
      expect(tokenLegend.tokenTypes).toContain("type");
      expect(tokenLegend.tokenTypes).toContain("class");
    });

    it("should define token modifiers", () => {
      expect(tokenLegend.tokenModifiers).toContain("declaration");
      expect(tokenLegend.tokenModifiers).toContain("definition");
      expect(tokenLegend.tokenModifiers).toContain("documentation");
    });
  });
});
