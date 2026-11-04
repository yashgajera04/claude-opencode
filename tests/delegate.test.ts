import { describe, it, expect, afterEach } from "vitest";
import { delegate } from "../src/delegate.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chmodSync } from "node:fs";

const here = dirname(fileURLToPath(import.meta.url));
const FAKE = join(here, "fixtures", "fake-opencode.sh");
chmodSync(FAKE, 0o755);

const env = (mode: string): NodeJS.ProcessEnv => ({
  ...process.env,
  OPENCODE_DELEGATE_BIN: FAKE,
  OPENCODE_DELEGATE_TIMEOUT_S: "5",
  FAKE_MODE: mode,
});

afterEach(() => {
  delete process.env.FAKE_MODE;
});

describe("delegate", () => {
  it("returns the four-line shape and stays under 2800 chars on success", async () => {
    process.env.FAKE_MODE = "ok";
    const out = await delegate({ spec: "do it", cwd: here }, env("ok"));
    expect(out).toMatch(/^STATUS: ok$/m);
    expect(out).toMatch(/^SUMMARY: /m);
    expect(out).toMatch(/^CHANGES: /m);
    expect(out).toMatch(/^TESTS: /m);
    expect(out.length).toBeLessThanOrEqual(2800);
  });

  it("rejects an empty spec without spawning", async () => {
    await expect(delegate({ spec: "   ", cwd: here }, env("ok"))).rejects.toThrow(/spec/i);
  });

  it("rejects a spec over 8000 chars", async () => {
    await expect(delegate({ spec: "x".repeat(8001), cwd: here }, env("ok"))).rejects.toThrow(/spec/i);
  });

  it("rejects a cwd that does not exist", async () => {
    await expect(delegate({ spec: "do it", cwd: "/no/such/dir-xyz" }, env("ok"))).rejects.toThrow(/cwd/i);
  });

  it("reports failed with the stderr tail on non-zero exit", async () => {
    process.env.FAKE_MODE = "fail";
    const out = await delegate({ spec: "do it", cwd: here }, env("fail"));
    expect(out).toMatch(/^STATUS: failed$/m);
    expect(out).toContain("boom happened");
  });

  it("stays under 2800 chars for 5 MB of output", async () => {
    process.env.FAKE_MODE = "big";
    const out = await delegate({ spec: "do it", cwd: here }, env("big"));
    expect(out.length).toBeLessThanOrEqual(2800);
    expect(out).toMatch(/^STATUS: ok$/m);
  });

  it("includes the last test line from opencode output in TESTS", async () => {
    process.env.FAKE_MODE = "tests";
    const out = await delegate({ spec: "do it", cwd: here }, env("tests"));
    expect(out).toMatch(/^TESTS: 3 passed, 0 failed$/m);
  });

  it("keeps all four sections within 2800 chars for a noisy failed run", async () => {
    process.env.FAKE_MODE = "failbig";
    const out = await delegate({ spec: "do it", cwd: here }, env("failbig"));
    expect(out.length).toBeLessThanOrEqual(2800);
    for (const label of ["STATUS:", "SUMMARY:", "CHANGES:", "TESTS:"]) {
      expect(out).toMatch(new RegExp(`^${label}`, "m"));
    }
    expect(out).toMatch(/^STATUS: failed$/m);
  });

  it("shows stderr when opencode exits 0 with an empty message (blocked permission)", async () => {
    process.env.FAKE_MODE = "silent";
    const out = await delegate({ spec: "do it", cwd: here }, env("silent"));
    expect(out).toContain("auto-rejecting");
  });

  it("returns STATUS: cancelled when the abort signal fires", async () => {
    process.env.FAKE_MODE = "sleep";
    const ac = new AbortController();
    setTimeout(() => ac.abort(), 300);
    const out = await delegate({ spec: "do it", cwd: here }, env("sleep"), ac.signal);
    expect(out).toMatch(/^STATUS: cancelled$/m);
  });

  it("reports a missing binary as STATUS: error with an install hint", async () => {
    const e = { ...env("ok"), OPENCODE_DELEGATE_BIN: "/nonexistent/oc-xyz" };
    const out = await delegate({ spec: "do it", cwd: here }, e);
    expect(out).toMatch(/^STATUS: error$/m);
    expect(out.toLowerCase()).toContain("install opencode");
  });
});
