import { describe, it, expect, afterEach } from "vitest";
import { runOpencode } from "../src/runner.js";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { chmodSync } from "node:fs";

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
});
