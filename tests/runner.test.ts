import { describe, it, expect, afterEach } from "vitest";
import { runOpencode, killAllRunning } from "../src/runner.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chmodSync, existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const marker = () => join(mkdtempSync(join(tmpdir(), "rn-")), "late-file");

const here = dirname(fileURLToPath(import.meta.url));
const FAKE = join(here, "fixtures", "fake-opencode.sh");
chmodSync(FAKE, 0o755);

const base = { spec: "do the thing", cwd: here, timeoutS: 5, bin: FAKE };

afterEach(() => {
  delete process.env.FAKE_MODE;
});

describe("runOpencode", () => {
  it("returns ok with the message when the process exits 0", async () => {
    process.env.FAKE_MODE = "ok";
    const r = await runOpencode(base);
    expect(r.status).toBe("ok");
    expect(r.message).toContain("done: changed 1 file");
  });

  it("returns failed with the stderr tail on non-zero exit", async () => {
    process.env.FAKE_MODE = "fail";
    const r = await runOpencode(base);
    expect(r.status).toBe("failed");
    expect(r.stderrTail).toContain("boom happened");
  });

  it("returns timeout and kills the child quickly", async () => {
    process.env.FAKE_MODE = "sleep";
    const t = Date.now();
    const r = await runOpencode({ ...base, timeoutS: 1 });
    expect(r.status).toBe("timeout");
    expect(Date.now() - t).toBeLessThan(4000);
  });

  it("keeps a 5 MB output within 2000 chars and keeps the tail", async () => {
    process.env.FAKE_MODE = "big";
    const r = await runOpencode(base);
    expect(r.status).toBe("ok");
    expect(r.message.length).toBeLessThanOrEqual(2000);
    expect(r.message).toContain("final line");
  });

  it("returns error with an install hint when the binary is missing", async () => {
    const r = await runOpencode({ ...base, bin: "/nonexistent/opencode-xyz" });
    expect(r.status).toBe("error");
    expect(r.message.toLowerCase()).toContain("install opencode");
  });

  it("passes run, --model and the spec as one argument; --auto only when asked", async () => {
    process.env.FAKE_MODE = "args";
    const r = await runOpencode({ ...base, model: "prov/mod", spec: "two words; $(rm -rf /)" });
    expect(r.message).toContain("ARG:run");
    expect(r.message).toContain("ARG:--model");
    expect(r.message).toContain("ARG:prov/mod");
    expect(r.message).toContain("ARG:two words; $(rm -rf /)");
    expect(r.message).toContain("ARG:--dir");
    expect(r.message).toContain(`ARG:${here}`);
    expect(r.message).not.toContain("ARG:--auto");
    const r2 = await runOpencode({ ...base, auto: true });
    expect(r2.message).toContain("ARG:--auto");
  });

  it("puts -- before the spec so a spec starting with '- ' is not parsed as flags", async () => {
    process.env.FAKE_MODE = "args";
    const r = await runOpencode({ ...base, spec: "- Goal: add a thing" });
    const lines = r.message.split("\n");
    expect(lines.slice(-2)).toEqual(["ARG:--", "ARG:- Goal: add a thing"]);
  });

  it("reports ok promptly when opencode exits but a background child keeps the pipes open", async () => {
    process.env.FAKE_MODE = "bg";
    process.env.FAKE_FILE = marker();
    const t = Date.now();
    const r = await runOpencode({ ...base, timeoutS: 10 });
    expect(r.status).toBe("ok");
    expect(r.message).toContain("All done");
    expect(Date.now() - t).toBeLessThan(2500);
  });

  it("kills leftover background processes after a normal exit", async () => {
    process.env.FAKE_MODE = "bg";
    const file = (process.env.FAKE_FILE = marker());
    await runOpencode({ ...base, timeoutS: 10 });
    await sleep(2800);
    expect(existsSync(file)).toBe(false);
  });

  it("returns cancelled and kills the child when the abort signal fires", async () => {
    process.env.FAKE_MODE = "touch";
    const file = (process.env.FAKE_FILE = marker());
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 300);
    const r = await runOpencode({ ...base, timeoutS: 10, signal: ac.signal });
    expect(r.status).toBe("cancelled");
    await sleep(2500);
    expect(existsSync(file)).toBe(false);
  });

  it("killAllRunning stops in-flight runs (used on server shutdown)", async () => {
    process.env.FAKE_MODE = "touch";
    const file = (process.env.FAKE_FILE = marker());
    const p = runOpencode({ ...base, timeoutS: 10 });
    await sleep(300);
    killAllRunning();
    const r = await p;
    expect(r.status).toBe("cancelled");
    await sleep(2500);
    expect(existsSync(file)).toBe(false);
  });
});
