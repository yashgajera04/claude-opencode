import { spawn } from "node:child_process";
import { capText, tailChars } from "./cap.js";

export type RunResult = {
  status: "ok" | "failed" | "timeout" | "error";
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
};

const KEEP_BYTES = 64 * 1024;
const MESSAGE_CHARS = 1500;

/** Append a chunk but keep only the last KEEP_BYTES chars. */
function appendBounded(buf: string, chunk: string): string {
  const next = buf + chunk;
  return next.length > KEEP_BYTES ? next.slice(next.length - KEEP_BYTES) : next;
}

export function runOpencode(opts: RunOptions): Promise<RunResult> {
  const bin = opts.bin ?? "opencode";
  // OpenCode ignores the spawn cwd and works in the caller's directory unless told
  // explicitly (found by a real e2e run), so always pass --dir.
  const args = ["run", "--dir", opts.cwd];
  if (opts.model) args.push("--model", opts.model);
  if (opts.auto) args.push("--auto");
  args.push(opts.spec);

  return new Promise((resolve) => {
    let out = "";
    let err = "";
    let settled = false;
    let timedOut = false;

    // detached => own process group, so we can kill opencode's children too.
    const child = spawn(bin, args, {
      cwd: opts.cwd,
      env: { ...process.env, PWD: opts.cwd },
      detached: true, stdio: ["ignore", "pipe", "pipe"] });

    const finish = (r: RunResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(r);
    };

    const killGroup = (sig: NodeJS.Signals) => {
      try {
        if (child.pid) process.kill(-child.pid, sig);
      } catch {
        /* already gone */
      }
    };

    const timer = setTimeout(() => {
      timedOut = true;
      killGroup("SIGTERM");
      setTimeout(() => killGroup("SIGKILL"), 2000).unref();
      // Do not wait for pipes to close: grandchildren may hold them open.
      finish({
        status: "timeout",
        message: `opencode timed out after ${opts.timeoutS}s`,
        stderrTail: tailChars(err, 600),
      });
    }, opts.timeoutS * 1000);

    child.stdout.on("data", (d: Buffer) => (out = appendBounded(out, d.toString())));
    child.stderr.on("data", (d: Buffer) => (err = appendBounded(err, d.toString())));

    child.on("error", (e: NodeJS.ErrnoException) => {
      finish({
        status: "error",
        message:
          e.code === "ENOENT"
            ? "opencode binary not found. Install opencode (https://opencode.ai) and make sure it is on PATH."
            : `failed to start opencode: ${e.message}`,
        stderrTail: "",
      });
    });

    child.on("close", (code) => {
      if (timedOut) return;
      const message = capText(out.trim(), MESSAGE_CHARS);
      finish({
        status: code === 0 ? "ok" : "failed",
        message,
        stderrTail: tailChars(err.trim(), 600),
      });
    });
  });
}
