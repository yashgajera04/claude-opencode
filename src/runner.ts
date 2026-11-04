import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { delimiter, join } from "node:path";
import { capText, tailChars } from "./cap.js";

export type RunResult = {
  status: "ok" | "failed" | "timeout" | "error" | "cancelled";
  message: string;
  stderrTail: string;
};

export type RunOptions = {
  spec: string;
  cwd: string;
  model?: string;
  timeoutS: number;
  bin?: string;
  auto?: boolean;
  signal?: AbortSignal;
};

const KEEP_CHARS = 64 * 1024;
const MESSAGE_CHARS = 1500;
const DRAIN_MS = 300; // after opencode exits, wait this long for buffered output
const MAX_TIMER_S = 2_000_000; // setTimeout overflows above ~2147483 s

/** Cancel functions of runs in flight, so the server can stop them on shutdown. */
const running = new Set<() => void>();

/** Stop every in-flight run (SIGTERM, then SIGKILL, to its process group). */
export function killAllRunning(): void {
  for (const cancel of [...running]) cancel();
}

const IS_WIN = process.platform === "win32";

/**
 * On Windows, Node can only spawn real executables without a shell, and npm's
 * `opencode` is a `.cmd` shim. Going through cmd.exe would let the spec inject
 * commands, so find the real `opencode.exe` instead: on PATH, or the binary the
 * npm shim points at (`<npm dir>/node_modules/opencode-ai/bin/opencode.exe`).
 */
export function resolveBin(bin: string, env: NodeJS.ProcessEnv = process.env, isWin = IS_WIN): string {
  if (!isWin || /[\\/]/.test(bin) || /\.[a-z0-9]+$/i.test(bin)) return bin;
  const dirs = (env.PATH ?? env.Path ?? "").split(delimiter).filter(Boolean);
  for (const dir of dirs) {
    const exe = join(dir, `${bin}.exe`);
    if (existsSync(exe)) return exe;
    if (bin === "opencode" && existsSync(join(dir, "opencode.cmd"))) {
      const npmExe = join(dir, "node_modules", "opencode-ai", "bin", "opencode.exe");
      if (existsSync(npmExe)) return npmExe;
    }
  }
  return bin;
}

/** Append a chunk but keep only the last KEEP_CHARS chars. */
function appendBounded(buf: string, chunk: string): string {
  const next = buf + chunk;
  return next.length > KEEP_CHARS ? next.slice(next.length - KEEP_CHARS) : next;
}

export function runOpencode(opts: RunOptions): Promise<RunResult> {
  let bin = resolveBin(opts.bin ?? "opencode");
  // OpenCode ignores the spawn cwd and works in the caller's directory unless told
  // explicitly (found by a real e2e run), so always pass --dir.
  const args = ["run", "--dir", opts.cwd];
  if (opts.model) args.push("--model", opts.model);
  if (opts.auto) args.push("--auto");
  // `--` so a spec that starts with "-" (e.g. a markdown list) is not parsed as flags.
  args.push("--", opts.spec);
  // A Node script as bin runs under this Node (cross-platform; used by the tests).
  if (/\.[cm]?js$/i.test(bin)) {
    args.unshift(bin);
    bin = process.execPath;
  }

  if (opts.signal?.aborted) {
    return Promise.resolve({ status: "cancelled", message: "cancelled before start", stderrTail: "" });
  }

  return new Promise((resolve) => {
    let out = "";
    let err = "";
    let settled = false;
    let exitCode: number | null | undefined;
    let drainTimer: NodeJS.Timeout | undefined;

    // POSIX: detached => own process group, so we can kill opencode's children too.
    // Windows has no process groups (detached there means a new console), so the
    // tree is killed with taskkill /T instead.
    const child = spawn(bin, args, {
      cwd: opts.cwd,
      env: { ...process.env, PWD: opts.cwd },
      detached: !IS_WIN,
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
    });

    const killGroup = (sig: NodeJS.Signals) => {
      try {
        if (child.pid) process.kill(-child.pid, sig);
      } catch {
        /* already gone */
      }
    };
    const killTree = () => {
      if (IS_WIN) {
        // Finds the tree through parent PIDs, so it cannot reach children whose
        // parent (opencode) has already exited. See README "Windows".
        if (child.pid) {
          spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true }).on(
            "error",
            () => {},
          );
        }
        return;
      }
      killGroup("SIGTERM");
      setTimeout(() => killGroup("SIGKILL"), 2000).unref();
    };

    const finish = (r: RunResult, kill: boolean) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(drainTimer);
      running.delete(cancel);
      opts.signal?.removeEventListener("abort", cancel);
      // Never leave opencode's background children (dev servers, watchers) running.
      if (kill) killTree();
      child.stdout?.destroy();
      child.stderr?.destroy();
      resolve(r);
    };

    const cancel = () => {
      finish({ status: "cancelled", message: "cancelled", stderrTail: tailChars(err.trim(), 600) }, true);
    };
    running.add(cancel);
    opts.signal?.addEventListener("abort", cancel, { once: true });

    const timer = setTimeout(() => {
      finish(
        {
          status: "timeout",
          message: capText(out.trim(), MESSAGE_CHARS) || `opencode timed out after ${opts.timeoutS}s`,
          stderrTail: tailChars(err.trim(), 600),
        },
        true,
      );
    }, Math.min(opts.timeoutS, MAX_TIMER_S) * 1000);

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (d: string) => (out = appendBounded(out, d)));
    child.stderr.on("data", (d: string) => (err = appendBounded(err, d)));

    child.on("error", (e: NodeJS.ErrnoException) => {
      finish(
        {
          status: "error",
          message:
            e.code === "ENOENT"
              ? "opencode binary not found. Install opencode (https://opencode.ai) and make sure it is on PATH" +
                (IS_WIN ? ", or set OPENCODE_DELEGATE_BIN to the full path of opencode.exe." : ".")
              : `failed to start opencode: ${e.message}`,
          stderrTail: "",
        },
        false,
      );
    });

    const complete = () =>
      finish(
        {
          status: exitCode === 0 ? "ok" : "failed",
          message: capText(out.trim(), MESSAGE_CHARS),
          stderrTail: tailChars(err.trim(), 600),
        },
        true,
      );

    // `exit` fires when opencode itself ends; `close` waits for every holder of the
    // pipes, which a background child can keep open forever. Allow a short drain.
    child.on("exit", (code) => {
      exitCode = code;
      drainTimer = setTimeout(complete, DRAIN_MS);
    });
    child.on("close", () => {
      if (exitCode !== undefined) complete();
    });
  });
}
