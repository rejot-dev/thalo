import { describe, expect, test } from "vitest";
import { rehypeThalo } from "./rehype-thalo";
import type { Root, Element } from "hast";

describe("rehypeThalo", () => {
  const plugin = rehypeThalo();

  function createCodeBlock(language: string, code: string): Element {
    return {
      type: "element",
      tagName: "code",
      properties: {
        className: [`language-${language}`],
      },
      children: [{ type: "text", value: code }],
    };
  }

  function createPreWithCode(language: string, code: string): { pre: Element; code: Element } {
    const codeEl = createCodeBlock(language, code);
    const preEl: Element = {
      type: "element",
      tagName: "pre",
      properties: {},
      children: [codeEl],
    };
    return { pre: preEl, code: codeEl };
  }

  function createTree(preElements: Element[]): Root {
    return {
      type: "root",
      children: preElements,
    };
  }

  test("converts language-thalo to language-text", () => {
    const { pre, code } = createPreWithCode("thalo", "2026-01-08T14:30Z create opinion");
    const tree = createTree([pre]);

    plugin(tree);

    expect(code.properties?.className).toContain("language-text");
    expect(code.properties?.className).not.toContain("language-thalo");
  });

  test("adds data-language attribute to parent pre element", () => {
    const { pre, code } = createPreWithCode("thalo", "2026-01-08T14:30Z create opinion");
    const tree = createTree([pre]);

    plugin(tree);

    expect(pre.properties?.["data-language"]).toBe("thalo");
    // Code element should NOT have data-language (it's on pre now)
    expect(code.properties?.["data-language"]).toBeUndefined();
  });

  test("does not modify non-thalo code blocks", () => {
    const { pre, code } = createPreWithCode("typescript", "const x = 1;");
    const tree = createTree([pre]);

    plugin(tree);

    expect(code.properties?.className).toContain("language-typescript");
    expect(code.properties?.className).not.toContain("language-text");
    expect(pre.properties?.["data-language"]).toBeUndefined();
  });

  test("handles lang-thalo class format", () => {
    const codeEl: Element = {
      type: "element",
      tagName: "code",
      properties: {
        className: ["lang-thalo"],
      },
      children: [{ type: "text", value: "test" }],
    };
    const preEl: Element = {
      type: "element",
      tagName: "pre",
      properties: {},
      children: [codeEl],
    };
    const tree = createTree([preEl]);

    plugin(tree);

    expect(codeEl.properties?.className).toContain("lang-text");
    expect(codeEl.properties?.className).not.toContain("lang-thalo");
    expect(preEl.properties?.["data-language"]).toBe("thalo");
  });

  test("preserves other classes on thalo blocks", () => {
    const codeEl: Element = {
      type: "element",
      tagName: "code",
      properties: {
        className: ["language-thalo", "custom-class"],
      },
      children: [{ type: "text", value: "test" }],
    };
    const preEl: Element = {
      type: "element",
      tagName: "pre",
      properties: {},
      children: [codeEl],
    };
    const tree = createTree([preEl]);

    plugin(tree);

    expect(codeEl.properties?.className).toContain("custom-class");
    expect(codeEl.properties?.className).toContain("language-text");
  });

  test("handles code blocks without className", () => {
    const codeEl: Element = {
      type: "element",
      tagName: "code",
      properties: {},
      children: [{ type: "text", value: "test" }],
    };
    const preEl: Element = {
      type: "element",
      tagName: "pre",
      properties: {},
      children: [codeEl],
    };
    const tree = createTree([preEl]);

    // Should not throw
    expect(() => plugin(tree)).not.toThrow();
    expect(preEl.properties?.["data-language"]).toBeUndefined();
  });

  test("handles multiple code blocks", () => {
    const { pre: thaloPre, code: thaloCode } = createPreWithCode(
      "thalo",
      "2026-01-08T14:30Z create opinion",
    );
    const { pre: tsPre, code: tsCode } = createPreWithCode("typescript", "const x = 1;");
    const { pre: thaloPre2, code: thaloCode2 } = createPreWithCode(
      "thalo",
      "2026-01-09T10:00Z update opinion",
    );
    const tree = createTree([thaloPre, tsPre, thaloPre2]);

    plugin(tree);

    // First thalo block converted
    expect(thaloCode.properties?.className).toContain("language-text");
    expect(thaloPre.properties?.["data-language"]).toBe("thalo");

    // TypeScript block unchanged
    expect(tsCode.properties?.className).toContain("language-typescript");
    expect(tsPre.properties?.["data-language"]).toBeUndefined();

    // Second thalo block converted
    expect(thaloCode2.properties?.className).toContain("language-text");
    expect(thaloPre2.properties?.["data-language"]).toBe("thalo");
  });
});
