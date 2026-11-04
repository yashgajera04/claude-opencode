import { statSync } from "node:fs";
import { capText, lastTestLine } from "./cap.js";
import { runOpencode } from "./runner.js";
import { snapshot, changesSince } from "./gitSummary.js";

export const MAX_SPEC_CHARS = 8000;
export const MAX_RESULT_CHARS = 2800;

// Each section has its own budget so they always sum to < MAX_RESULT_CHARS and no
// section can push another out:  1200 + 400 + 800 + 200 + labels (~60) = ~2660.
const SUMMARY_CHARS = 1200;
const STDERR_CHARS = 400;

export type DelegateArgs = { spec: string; cwd: string };

const BLOCKED = /reject|denied|permission/i;

export async function delegate(
  args: DelegateArgs,
  env: NodeJS.ProcessEnv = process.env,
  signal?: AbortSignal,
): Promise<string> {
  const spec = args.spec?.trim() ?? "";
  if (spec.length === 0) throw new Error("spec must not be empty");
  if (spec.length > MAX_SPEC_CHARS) throw new Error(`spec is too long (${spec.length} > ${MAX_SPEC_CHARS} chars)`);

  let isDir = false;
  try {
    isDir = statSync(args.cwd).isDirectory();
  } catch {
    /* handled below */
  }
  if (!isDir) throw new Error(`cwd does not exist or is not a directory: ${capText(args.cwd, 200)}`);

  const timeoutS = Number(env.OPENCODE_DELEGATE_TIMEOUT_S) > 0 ? Number(env.OPENCODE_DELEGATE_TIMEOUT_S) : 600;

  const before = await snapshot(args.cwd);
  const run = await runOpencode({
    spec,
    cwd: args.cwd,
    model: env.OPENCODE_DELEGATE_MODEL || undefined,
    timeoutS,
    bin: env.OPENCODE_DELEGATE_BIN || undefined,
    auto: env.OPENCODE_DELEGATE_AUTO === "1",
    signal,
  });

  let summary = capText(run.message, SUMMARY_CHARS);
  // stderr matters when the run did not cleanly succeed, said nothing, or was blocked.
  if (run.stderrTail && (run.status !== "ok" || run.message === "" || BLOCKED.test(run.stderrTail))) {
    summary += `${summary ? "\n" : ""}stderr: ${capText(run.stderrTail, STDERR_CHARS)}`;
  }
  const changes = run.status === "error" ? "(not run)" : await changesSince(before, args.cwd);
  const tests = lastTestLine(run.message) ?? "(none reported)";

  const out = `STATUS: ${run.status}\nSUMMARY: ${summary}\nCHANGES: ${changes}\nTESTS: ${tests}`;
  return capText(out, MAX_RESULT_CHARS); // safety net; section budgets keep it from firing
}
