/** Keep head and tail of `text` so the result is at most `maxChars` long. */
export function capText(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  const dropped = text.length - maxChars;
  // Reserve room for the marker; its digit count depends on `dropped`.
  let marker = `\n…[truncated ${dropped} chars]…\n`;
  const budget = Math.max(0, maxChars - marker.length);
  marker = `\n…[truncated ${text.length - budget} chars]…\n`;
  const keep = Math.max(0, maxChars - marker.length);
  const head = Math.ceil(keep / 2);
  const tail = keep - head;
  const out = text.slice(0, head) + marker + (tail > 0 ? text.slice(text.length - tail) : "");
  return out.length <= maxChars ? out : out.slice(0, maxChars);
}

export function tailChars(text: string, n: number): string {
  return text.length <= n ? text : text.slice(text.length - n);
}

// Counted results ("3 passed", "passed: 3", "Tests: ...") are test output; bare
// words like "error" or a stray digit in prose are not.
const COUNTED = /\b\d+\s+(passed|failed|failing|passing|skipped)\b|\b(passed|failed)\s*[:=]\s*\d+|^\s*Tests?:/i;
const VERDICT = /^\s*(PASS|FAIL)\b/; // case-sensitive: jest/vitest style "FAIL path"
const MAX_TEST_LINE = 200;

/** Last line that looks like a test summary, at most 200 chars. */
export function lastTestLine(text: string): string | null {
  const lines = text.split("\n");
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i].trim();
    if (line && (COUNTED.test(line) || VERDICT.test(line))) return line.slice(0, MAX_TEST_LINE);
  }
  return null;
}
