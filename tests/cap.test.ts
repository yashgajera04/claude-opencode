import { describe, it, expect } from "vitest";
import { capText, lastTestLine, tailChars } from "../src/cap.js";

describe("capText", () => {
  it("returns input unchanged when under the cap", () => {
    expect(capText("hello", 100)).toBe("hello");
  });

  it("returns at most maxChars and includes the truncation marker when over", () => {
    const out = capText("a".repeat(5000), 500);
    expect(out.length).toBeLessThanOrEqual(500);
    expect(out).toContain("…[truncated");
  });

  it("handles a 5 MB string in under 100 ms", () => {
    const big = "x".repeat(5 * 1024 * 1024);
    const t = Date.now();
    capText(big, 1500);
    expect(Date.now() - t).toBeLessThan(100);
  });
});

describe("lastTestLine", () => {
  it("returns the last line that looks like a test summary", () => {
    expect(lastTestLine("a\n3 passed, 1 failed\nbye")).toBe("3 passed, 1 failed");
  });

  it("returns null when nothing matches", () => {
    expect(lastTestLine("nothing here\nat all")).toBeNull();
  });
});

describe("tailChars", () => {
  it("returns the last n characters", () => {
    expect(tailChars("abcdef", 3)).toBe("def");
    expect(tailChars("ab", 5)).toBe("ab");
  });
});
