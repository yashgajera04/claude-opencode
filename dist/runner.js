import { spawn } from "node:child_process";
import { capText, tailChars } from "./cap.js";
const KEEP_BYTES = 64 * 1024;
const MESSAGE_CHARS = 1500;
/** Append a chunk but keep only the last KEEP_BYTES chars. */
function appendBounded(buf, chunk) {
    const next = buf + chunk;
    return next.length > KEEP_BYTES ? next.slice(next.length - KEEP_BYTES) : next;
}
export function runOpencode(opts) {
    const bin = opts.bin ?? "opencode";
    const args = ["run"];
    if (opts.model)
        args.push("--model", opts.model);
    if (opts.auto)
        args.push("--auto");
    args.push(opts.spec);
    return new Promise((resolve) => {
        let out = "";
        let err = "";
        let settled = false;
        let timedOut = false;
        // detached => own process group, so we can kill opencode's children too.
        const child = spawn(bin, args, { cwd: opts.cwd, detached: true, stdio: ["ignore", "pipe", "pipe"] });
        const finish = (r) => {
            if (settled)
                return;
            settled = true;
            clearTimeout(timer);
            resolve(r);
        };
        const killGroup = (sig) => {
            try {
                if (child.pid)
                    process.kill(-child.pid, sig);
            }
            catch {
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
        child.stdout.on("data", (d) => (out = appendBounded(out, d.toString())));
        child.stderr.on("data", (d) => (err = appendBounded(err, d.toString())));
        child.on("error", (e) => {
            finish({
                status: "error",
                message: e.code === "ENOENT"
                    ? "opencode binary not found. Install opencode (https://opencode.ai) and make sure it is on PATH."
                    : `failed to start opencode: ${e.message}`,
                stderrTail: "",
            });
        });
        child.on("close", (code) => {
            if (timedOut)
                return;
            const message = capText(out.trim(), MESSAGE_CHARS);
            finish({
                status: code === 0 ? "ok" : "failed",
                message,
                stderrTail: tailChars(err.trim(), 600),
            });
        });
    });
}
