import { describe, it, expect } from "vitest";
import { snapshot, changesSince } from "../src/gitSummary.js";
import { mkdtempSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

function tmp(): string {
  return mkdtempSync(join(tmpdir(), "gs-"));
}
function git(cwd: string, ...args: string[]) {
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd, stdio: "ignore" });
}
function repo(): string {
  const d = tmp();
  git(d, "init", "-q");
  writeFileSync(join(d, "a.txt"), "one\n");
  git(d, "add", "-A");
  git(d, "commit", "-qm", "init");
  return d;
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("changesSince", () => {
  it("reports (not a git repo) outside a repo", async () => {
    const d = tmp();
    expect(await changesSince(await snapshot(d), d)).toBe("(not a git repo)");
  });

  it("reports (no changes) when nothing changed since the snapshot", async () => {
    const d = repo();
    expect(await changesSince(await snapshot(d), d)).toBe("(no changes)");
  });

  it("lists a modified file and a new untracked file", async () => {
    const d = repo();
    const before = await snapshot(d);
    writeFileSync(join(d, "a.txt"), "one\ntwo\n");
    writeFileSync(join(d, "new.txt"), "hi\n");
    const out = await changesSince(before, d);
    expect(out).toContain("a.txt");
    expect(out).toContain("new.txt");
  });

  it("does not report edits that were already there before the run", async () => {
    const d = repo();
    writeFileSync(join(d, "a.txt"), "user's own edit\n");
    const before = await snapshot(d);
    writeFileSync(join(d, "new.txt"), "hi\n");
    const out = await changesSince(before, d);
    expect(out).toContain("new.txt");
    expect(out).not.toContain("a.txt");
  });

  it("reports a file edited again after the snapshot (a retry)", async () => {
    const d = repo();
    writeFileSync(join(d, "a.txt"), "first edit\n");
    const before = await snapshot(d);
    await sleep(20);
    writeFileSync(join(d, "a.txt"), "second, longer edit\n");
    expect(await changesSince(before, d)).toContain("a.txt");
  });

  it("collapses an untracked directory to one line so real files stay visible", async () => {
    const d = repo();
    const before = await snapshot(d);
    mkdirSync(join(d, ".venv"));
    for (let i = 0; i < 300; i++) writeFileSync(join(d, ".venv", `f${i}.py`), "x\n");
    writeFileSync(join(d, "hello.py"), "x\n");
    const out = await changesSince(before, d);
    expect(out).toContain("hello.py");
    expect(out).toContain(".venv/");
    expect(out).not.toContain("f1.py");
  });

  it("reports changes outside a subdirectory cwd", async () => {
    const d = repo();
    mkdirSync(join(d, "pkg"));
    const before = await snapshot(join(d, "pkg"));
    await sleep(20);
    writeFileSync(join(d, "a.txt"), "changed at the root, longer\n");
    expect(await changesSince(before, join(d, "pkg"))).toContain("a.txt");
  });

  it("caps output at 800 chars for 200 changed files", async () => {
    const d = repo();
    const before = await snapshot(d);
    for (let i = 0; i < 200; i++) writeFileSync(join(d, `file-with-a-long-name-${i}.txt`), "x\n");
    const out = await changesSince(before, d);
    expect(out.length).toBeLessThanOrEqual(800);
  });
});
