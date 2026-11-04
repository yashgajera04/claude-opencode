/** Keep head and tail of `text` so the result is at most `maxChars` long. */
export function capText(text, maxChars) {
    if (text.length <= maxChars)
        return text;
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
export function tailChars(text, n) {
    return text.length <= n ? text : text.slice(text.length - n);
}
const TEST_LINE = /(?=.*\d)(?=.*(pass|fail|error))/i;
/** Last line that looks like a test summary: contains a digit and pass/fail/error. */
export function lastTestLine(text) {
    const lines = text.split("\n");
    for (let i = lines.length - 1; i >= 0; i--) {
        const line = lines[i].trim();
        if (line && TEST_LINE.test(line))
            return line;
    }
    return null;
}
