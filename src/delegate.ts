import { statSync } from "node:fs";
import { capText, lastTestLine } from "./cap.js";
import { runOpencode } from "./runner.js";
import { diffStat } from "./gitSummary.js";

export const MAX_SPEC_CHARS = 8000;
export const MAX_RESULT_CHARS = 2800;
const SUMMARY_CHARS = 1500;

export type DelegateArgs = { spec: string; cwd: string };

export async function delegate(args: DelegateArgs, env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const spec = args.spec?.trim() ?? "";
  if (spec.length === 0) throw new Error("spec must not be empty");
  if (spec.length > MAX_SPEC_CHARS) throw new Error(`spec is too long (${spec.length} > ${MAX_SPEC_CHARS} chars)`);

  let isDir = false;
  try {
    isDir = statSync(args.cwd).isDirectory();
  } catch {
    /* handled below */
  }
  if (!isDir) throw new Error(`cwd does not exist or is not a directory: ${args.cwd}`);

  const timeoutS = Number(env.OPENCODE_DELEGATE_TIMEOUT_S) > 0 ? Number(env.OPENCODE_DELEGATE_TIMEOUT_S) : 600;

  const run = await runOpencode({
    spec,
    cwd: args.cwd,
    model: env.OPENCODE_DELEGATE_MODEL || undefined,
    timeoutS,
    bin: env.OPENCODE_DELEGATE_BIN || undefined,
    auto: env.OPENCODE_DELEGATE_AUTO === "1",
  });

  let summary = capText(run.message, SUMMARY_CHARS);
  if ((run.status === "failed" || run.status === "timeout") && run.stderrTail) {
    summary += `\nstderr: ${run.stderrTail}`;
  }
  const changes = run.status === "error" ? "(not run)" : await diffStat(args.cwd);
  const tests = lastTestLine(run.message) ?? "(none reported)";

  const out = `STATUS: ${run.status}\nSUMMARY: ${summary}\nCHANGES: ${changes}\nTESTS: ${tests}`;
  return capText(out, MAX_RESULT_CHARS);
}
