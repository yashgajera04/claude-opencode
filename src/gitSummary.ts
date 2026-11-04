import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { statSync } from "node:fs";
import { join } from "node:path";
import { capText } from "./cap.js";

const run = promisify(execFile);
const MAX_CHARS = 800;

/** path (relative to repo root) -> signature of its state: git status code + size + mtime. */
export type Snapshot = { root: string; files: Map<string, string> } | null;

async function git(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await run("git", args, { cwd, maxBuffer: 16 * 1024 * 1024 });
  return stdout;
}

function signature(root: string, xy: string, path: string): string {
  try {
    const s = statSync(join(root, path));
    return `${xy}|${s.size}|${s.mtimeMs}`;
  } catch {
    return `${xy}|gone`;
  }
}

/**
 * State of every changed or untracked path in the repo containing `cwd`.
 * `--untracked-files=normal` collapses an untracked directory (.venv/, node_modules/)
 * to a single entry. Returns null when `cwd` is not inside a git repo.
 */
export async function snapshot(cwd: string): Promise<Snapshot> {
  let root: string;
  try {
    root = (await git(cwd, ["rev-parse", "--show-toplevel"])).trim();
  } catch {
    return null;
  }
  const files = new Map<string, string>();
  try {
    const entries = (await git(root, ["status", "--porcelain=v1", "-z", "--untracked-files=normal"])).split("\0");
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (e.length < 4) continue;
      const xy = e.slice(0, 2);
      const path = e.slice(3);
      if (xy.includes("R") || xy.includes("C")) i++; // rename/copy: next entry is the original path
      files.set(path, signature(root, xy, path));
    }
  } catch {
    /* repo without commits or unreadable status: treat as empty */
  }
  return { root, files };
}

/** Paths that are new or changed since `before`, one per line, capped at 800 chars. */
export async function changesSince(before: Snapshot, cwd: string): Promise<string> {
  if (before === null) return "(not a git repo)";
  const after = await snapshot(cwd);
  if (after === null) return "(git summary unavailable)";
  const lines: string[] = [];
  for (const [path, sig] of after.files) {
    if (before.files.get(path) !== sig) lines.push(`${sig.split("|")[0].trim() || "?"} ${path}`);
  }
  if (lines.length === 0) return "(no changes)";
  return capText(lines.join("\n"), MAX_CHARS);
}
