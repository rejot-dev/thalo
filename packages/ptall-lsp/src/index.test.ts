import { describe, it, expect } from "vitest";
import { serverCapabilities, tokenLegend } from "./capabilities.js";

describe("ptall-lsp", () => {
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
