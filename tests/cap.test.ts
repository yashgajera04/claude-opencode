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

  it.each([
    "I added 2 files and the import error is resolved.",
    "Created 3 files, no errors",
    "Set the password minimum length to 12",
    "Added a bypass for 2 legacy routes",
    "Moved TypeError handling to line 40",
  ])("ignores ordinary prose: %s", (prose) => {
    expect(lastTestLine(`pytest: 2 failed, 1 passed\n${prose}`)).toBe("pytest: 2 failed, 1 passed");
  });

  it.each([
    "Tests: 5 passed, 5 total",
    "===== 1 failed, 4 passed in 0.12s =====",
    "ok 12 passed",
    "FAIL tests/foo.test.ts",
  ])("recognises real test summary: %s", (line) => {
    expect(lastTestLine(`x\n${line}\n`)).toBe(line);
  });

  it("limits the returned line to 200 chars", () => {
    const long = "3 passed " + "z".repeat(1000);
    expect(lastTestLine(long)!.length).toBeLessThanOrEqual(200);
  });
});

describe("tailChars", () => {
  it("returns the last n characters", () => {
    expect(tailChars("abcdef", 3)).toBe("def");
    expect(tailChars("ab", 5)).toBe("ab");
  });
});
