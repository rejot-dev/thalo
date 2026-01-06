import { describe, it, expect } from "vitest";
import { serverCapabilities } from "./capabilities.js";

describe("ptall-lsp", () => {
  describe("serverCapabilities", () => {
    it("should enable definition provider", () => {
      expect(serverCapabilities.definitionProvider).toBe(true);
    });

    it("should enable references provider", () => {
      expect(serverCapabilities.referencesProvider).toBe(true);
    });

    it("should disable hover provider until implemented", () => {
      expect(serverCapabilities.hoverProvider).toBe(false);
    });

    it("should not have completion provider until implemented", () => {
      expect(serverCapabilities.completionProvider).toBeUndefined();
    });
  });
});
