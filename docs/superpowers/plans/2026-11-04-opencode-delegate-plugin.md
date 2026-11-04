# OpenCode Delegate Plugin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Claude Code plugin where Claude only brainstorms and writes a compact task spec, and OpenCode executes it and returns a capped summary, so Claude spends about 2-5k tokens per task.

**Architecture:** A stdio MCP server exposes one tool, `delegate`. It spawns `opencode run` in the target directory, waits, then returns a hard-capped result: status, OpenCode's final message, `git diff --stat`, and the last test line. A slash command and a short skill tell Claude to delegate instead of reading or editing code itself.

**Tech Stack:** Node 20+, TypeScript, `@modelcontextprotocol/sdk`, `zod`, `vitest`, OpenCode CLI.

**Spec:** No separate spec file. The design is the conversation of 2026-11-04 (Claude plans, OpenCode executes, minimal tokens back). Requirements are in Global Constraints.

## Global Constraints

- Claude-side result per `delegate` call is at most 700 tokens (about 2,800 characters). This cap is enforced in code, not by prompt.
- Claude never receives raw OpenCode logs, file contents, or full diffs.
- The plugin has one tool, `delegate`. No other tools in v1.
- OpenCode model is configurable via env `OPENCODE_DELEGATE_MODEL` (format `provider/model`). Default: OpenCode's own default.
- Timeout default is 600 s, configurable via env `OPENCODE_DELEGATE_TIMEOUT_S`. On timeout the child process is killed and status is `timeout`.
- The server never runs in a directory outside the `cwd` argument and refuses a `cwd` that does not exist.

## Review Focus

- `opencode` binary missing from PATH: `delegate` returns status `error` with a one-line install hint. It does not crash the server.
- OpenCode prints 5 MB of output: result is still under the cap and the server memory stays bounded.
- `cwd` is not a git repo: result has diff stat `(not a git repo)` and does not fail.
- OpenCode exits non-zero: status `failed`, with the last 600 characters of stderr.
- Spec argument is empty or over 8,000 characters: rejected with a clear error before spawning.

---

### Task 1: Scaffold and verify the OpenCode CLI contract

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`
- Create: `docs/opencode-cli-notes.md`

**Interfaces:**
- Produces: confirmed OpenCode invocation (flags for message, model, working dir, output format) recorded in `docs/opencode-cli-notes.md`. Later tasks use exactly these flags.

- [ ] **Step 1: Init repo and deps.** `git init`, `npm init -y`, install `@modelcontextprotocol/sdk zod` and dev `typescript vitest @types/node tsx`. Set `"type": "module"` and scripts `build`, `test`.
- [ ] **Step 2: Verify the CLI.** Run `opencode --version`, `opencode run --help`, then `opencode run "reply with the word ok"` in a scratch dir. Record in the notes file: the exact flags for model selection, JSON/plain output, and how the final message is separated from progress output. If `opencode run` lacks a flag this plan assumes, update the later tasks here before continuing.
- [ ] **Step 3: Verify the build tooling.** Run `npx tsc --noEmit && npx vitest run --passWithNoTests`. Expected: exit 0.
- [ ] **Step 4: Commit** `chore: scaffold project and record opencode cli contract`.

### Task 2: Output capping utilities

**Files:**
- Create: `src/cap.ts`
- Test: `tests/cap.test.ts`

**Interfaces:**
- Produces: `capText(text: string, maxChars: number): string` (keeps head and tail, inserts `…[truncated N chars]…`), `lastTestLine(text: string): string | null` (last line matching `/(pass|fail|passed|failed|error)/i` with a digit), `tailChars(text: string, n: number): string`.

- [ ] **Step 1: Write failing tests.** `capText` returns input unchanged when under the cap; returns length <= maxChars when over; output contains the truncation marker. `lastTestLine("a\n3 passed, 1 failed\nbye")` returns `"3 passed, 1 failed"`; returns `null` when there is no match. `capText` on a 5 MB string finishes in under 100 ms.
- [ ] **Step 2: Run** `npx vitest run tests/cap.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement the three functions** in `src/cap.ts`. No dependencies.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: output capping utilities`.

### Task 3: OpenCode runner

**Files:**
- Create: `src/runner.ts`
- Test: `tests/runner.test.ts`, `tests/fixtures/fake-opencode.sh`

**Interfaces:**
- Consumes: `capText`, `tailChars` from Task 2.
- Produces: `type RunResult = { status: "ok" | "failed" | "timeout" | "error"; message: string; stderrTail: string }` and `runOpencode(opts: { spec: string; cwd: string; model?: string; timeoutS: number; bin?: string }): Promise<RunResult>`. `bin` defaults to `"opencode"` and exists so tests can point to the fake script.

- [ ] **Step 1: Write failing tests** using a fake bin script that (a) prints a message and exits 0, (b) exits 1 with stderr text, (c) sleeps 10 s, (d) prints 5 MB. Assert respectively: `ok` with the message; `failed` with `stderrTail` containing the text; `timeout` with `timeoutS: 1` in under 3 s and the child no longer running; `ok` with `message.length <= 2000` and bounded memory (stream into a ring buffer, do not concatenate). Also assert a missing bin gives `error` and a message mentioning "install opencode".
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement `runOpencode`** with `child_process.spawn` (no shell, args array), flags exactly as recorded in `docs/opencode-cli-notes.md`. Keep only the last 64 KB of stdout and stderr. Kill with SIGTERM, then SIGKILL after 2 s on timeout.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: opencode runner with timeout and bounded output`.

### Task 4: Git diff summary

**Files:**
- Create: `src/gitSummary.ts`
- Test: `tests/gitSummary.test.ts`

**Interfaces:**
- Produces: `diffStat(cwd: string): Promise<string>`. It returns `git diff --stat` plus untracked file names, capped at 800 characters. It returns `"(not a git repo)"` outside a repo and `"(no changes)"` when clean.

- [ ] **Step 1: Write failing tests** with temp dirs: not a repo gives `(not a git repo)`; clean repo gives `(no changes)`; a modified file and a new untracked file both appear in the output; 200 changed files give output of 800 characters or fewer.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement** with `git diff --stat` and `git ls-files --others --exclude-standard`, using `capText`.
- [ ] **Step 4: Run tests.** Expected: PASS.
- [ ] **Step 5: Commit** `feat: capped git diff summary`.

### Task 5: MCP server and the `delegate` tool

**Files:**
- Create: `src/server.ts`, `src/delegate.ts`
- Test: `tests/delegate.test.ts`

**Interfaces:**
- Consumes: `runOpencode`, `diffStat`, `capText`, `lastTestLine`.
- Produces: `delegate(args: { spec: string; cwd: string }, env: NodeJS.ProcessEnv): Promise<string>` returning text in this shape (at most 2,800 characters in total):
  ```
  STATUS: ok|failed|timeout|error
  SUMMARY: <opencode final message, capped 1500 chars>
  CHANGES: <diffStat>
  TESTS: <lastTestLine or "(none reported)">
  ```
  The MCP tool name is `delegate`, with a zod schema `{ spec: string (1..8000), cwd: string }`.

- [ ] **Step 1: Write failing tests** for `delegate` using the fake bin: success output has all four lines and total length <= 2800. Empty spec throws a validation error without spawning. Nonexistent `cwd` throws. Non-zero exit gives `STATUS: failed` and includes the stderr tail in SUMMARY. The 5 MB case stays <= 2800 characters.
- [ ] **Step 2: Run.** Expected: FAIL.
- [ ] **Step 3: Implement `delegate`** to validate, run, summarize, and enforce the final total cap with one last `capText`. Implement `src/server.ts` with `McpServer` and `StdioServerTransport`, registering `delegate`.
- [ ] **Step 4: Run tests, then smoke-test the server.** Run `npx vitest run`, then `npx tsx src/server.ts` and send an MCP `tools/list` request. Expected: one tool named `delegate`.
- [ ] **Step 5: Commit** `feat: mcp server with delegate tool`.

### Task 6: Plugin packaging, slash command and behavior skill

**Files:**
- Create: `.claude-plugin/plugin.json`, `.mcp.json`
- Create: `commands/delegate.md`, `skills/delegating-to-opencode/SKILL.md`
- Create: `README.md`

**Interfaces:**
- Consumes: built server at `dist/server.js`.
- Produces: an installable plugin exposing `mcp__opencode-delegate__delegate`, the command `/delegate <task>`, and the skill.

- [ ] **Step 1: Write the manifest and `.mcp.json`.** The MCP command is `node ${CLAUDE_PLUGIN_ROOT}/dist/server.js`. Run `npm run build` and commit `dist/`, or add an install-time build step, so the plugin works after a plain install.
- [ ] **Step 2: Write the skill.** Rules, kept under 25 lines: brainstorm briefly; write a spec of at most 300 words with goal, files, constraints and an acceptance command; call `delegate`; never read or edit project files yourself; judge the result only from `CHANGES` and `TESTS`; on failure, call `delegate` again with a short fix spec (max 2 retries), then ask the user.
- [ ] **Step 3: Write `commands/delegate.md`.** It takes `$ARGUMENTS`, tells Claude to apply the skill, and nothing more.
- [ ] **Step 4: Install locally and verify end to end.** Run `claude --plugin-dir .` in a scratch git repo and run `/delegate add a hello() function in hello.py with a pytest test`. Expected: Claude makes a single `delegate` call, the file and test exist, and the `TESTS` line reports a pass.
- [ ] **Step 5: Commit** `feat: plugin manifest, command and skill`.

### Task 7: Measure token usage and tune

**Files:**
- Create: `scripts/measure.md` (manual procedure), `docs/results.md`

- [ ] **Step 1: Run the same 3 tasks twice**: once with Claude doing the work directly, once via `/delegate`. Record the token counts from `/cost` (or `rtk gain`) for each. Pick one small task (a function), one medium (a 3-file change) and one with a failing test.
- [ ] **Step 2: Record results** in `docs/results.md` with the delegated-versus-direct ratio. If the delegated cost is more than 10k tokens per task, find which part is large (the spec, retries, or skill text) and trim it.
- [ ] **Step 3: Commit** `docs: measured token savings`.

---

## Self-Review Notes

- **Coverage:** capped output (Tasks 2, 4, 5), the OpenCode call (3), the plugin shell (6), and the savings claim (7) each have a task. The Review Focus items are tested in Tasks 3 to 5.
- **Open risk:** the exact `opencode run` flags are unverified. Task 1 Step 2 settles this before any code depends on them.
- **Out of scope for v1:** streaming progress, multiple parallel delegations, a persistent OpenCode session (`opencode serve`), and cost tracking inside the plugin.
