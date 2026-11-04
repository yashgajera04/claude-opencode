# Measured token usage (2026-11-04)

Task: "add `hello()` in `hello.py` returning `'hi'` with a pytest test; acceptance: `python3 -m pytest -q` passes". Run with `claude -p ... --output-format json`, Sonnet 5.5, in a fresh scratch git repo.

| Run | Turns | Output tokens | Cache read | Cache create | Cost (USD) |
|---|---|---|---|---|---|
| Delegated (`/opencode-delegate:delegate`) | 4 | 475 | 82,917 | 26,563 | 0.119 |
| Direct (Claude edits and tests itself) | 4 | 565 | 79,778 | 25,939 | 0.117 |

## What this shows
- **No saving on a trivial task.** Both runs cost about the same. Cost is dominated by the session's baseline context (about 105k cached tokens here: system prompt, tools, and many installed plugins), which both runs pay on every turn.
- The delegate result itself is small (under 2,800 chars, about 700 tokens). The earlier "2-5k tokens per task" estimate counted only the marginal tokens and left out this baseline.
- The saving should appear on medium and large tasks, where a direct run needs many turns of reading files, editing and re-running tests. That comparison is **not measured yet**. A 3-file change and a failing-test fix are the next two cases to run.

## Real-run findings fixed during the build
- OpenCode ignores the spawn `cwd` and works in the caller's directory, so the runner now always passes `--dir <cwd>`.
- Claude Code exposes the tool as `mcp__plugin_opencode-delegate_opencode-delegate__delegate`. The skill and README use that name.
