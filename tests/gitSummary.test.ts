import { describe, it, expect } from "vitest";
import { diffStat } from "../src/gitSummary.js";
import { mkdtempSync, writeFileSync } from "node:fs";
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

describe("diffStat", () => {
  it("reports (not a git repo) outside a repo", async () => {
    expect(await diffStat(tmp())).toBe("(not a git repo)");
  });

  it("reports (no changes) for a clean repo", async () => {
    expect(await diffStat(repo())).toBe("(no changes)");
  });

  it("lists a modified file and a new untracked file", async () => {
    const d = repo();
    writeFileSync(join(d, "a.txt"), "one\ntwo\n");
    writeFileSync(join(d, "new.txt"), "hi\n");
    const out = await diffStat(d);
    expect(out).toContain("a.txt");
    expect(out).toContain("new.txt");
  });

  it("caps output at 800 chars for 200 changed files", async () => {
    const d = repo();
    for (let i = 0; i < 200; i++) writeFileSync(join(d, `file-with-a-long-name-${i}.txt`), "x\n");
    const out = await diffStat(d);
    expect(out.length).toBeLessThanOrEqual(800);
  });
});
