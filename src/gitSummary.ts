import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { capText } from "./cap.js";

const run = promisify(execFile);
const MAX_CHARS = 800;

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

/** Short, capped summary of working-tree changes: `git diff --stat` plus untracked files. */
export async function diffStat(cwd: string): Promise<string> {
  try {
    await git(cwd, ["rev-parse", "--is-inside-work-tree"]);
  } catch {
    return "(not a git repo)";
  }
  try {
    const stat = (await git(cwd, ["diff", "--stat", "HEAD"])).trim();
    const untracked = (await git(cwd, ["ls-files", "--others", "--exclude-standard"])).trim();
    const parts: string[] = [];
    if (stat) parts.push(stat);
    if (untracked) parts.push("untracked:\n" + untracked);
    if (parts.length === 0) return "(no changes)";
    return capText(parts.join("\n"), MAX_CHARS);
  } catch (e) {
    // e.g. repo with no commits yet: `diff HEAD` fails. Fall back to status.
    try {
      const s = (await git(cwd, ["status", "--short"])).trim();
      return s ? capText(s, MAX_CHARS) : "(no changes)";
    } catch {
      return "(git summary unavailable)";
    }
  }
}
