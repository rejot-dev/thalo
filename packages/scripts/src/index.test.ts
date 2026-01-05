import { describe, expect, it, vi } from "vitest";
import { hello } from "./index";

describe("hello", () => {
  it("should log the correct message", () => {
    // Spy on console.log
    const consoleLogSpy = vi.spyOn(console, "log");

    // Call the function
    hello();

    // Assert that console.log was called with the expected message
    expect(consoleLogSpy).toHaveBeenCalledWith("Hello from @kc/scripts!");

    // Restore the original console.log
    consoleLogSpy.mockRestore();
  });
});
