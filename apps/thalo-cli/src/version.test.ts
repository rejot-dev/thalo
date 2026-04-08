import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.resetModules();
  vi.unmock("@rejot-dev/thalo/node");
});

describe("getVersionInfo", () => {
  it("returns an unknown parser backend when @rejot-dev/thalo/node is unavailable", async () => {
    vi.doMock("@rejot-dev/thalo/node", () => {
      throw new Error("module not found");
    });

    const { getVersionInfo } = await import("./version.js");
    const info = await getVersionInfo();

    expect(info.parserBackend).toBe("unknown");
  });

  it("reports the parser backend from @rejot-dev/thalo/node when available", async () => {
    vi.doMock("@rejot-dev/thalo/node", () => ({
      isInitialized: () => true,
      isUsingNative: () => false,
    }));

    const { getVersionInfo } = await import("./version.js");
    const info = await getVersionInfo();

    expect(info.parserBackend).toBe("wasm");
  });
});
