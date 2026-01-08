import { describe, expect, it, vi } from "vitest";
import { hello, parsePtall } from "./index";

describe("hello", () => {
  it("should log the correct message", () => {
    // Spy on console.log
    const consoleLogSpy = vi.spyOn(console, "log");

    // Call the function
    hello();

    // Assert that console.log was called with the expected message
    expect(consoleLogSpy).toHaveBeenCalledWith("Hello from @rejot-dev/scripts!");

    // Restore the original console.log
    consoleLogSpy.mockRestore();
  });
});

describe("parsePtall", () => {
  it("should parse 'hello' as a source_file", () => {
    const tree = parsePtall("hello");

    expect(tree.rootNode.type).toBe("source_file");
    expect(tree.rootNode.text).toBe("hello");
  });
});
