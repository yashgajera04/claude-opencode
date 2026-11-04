---
name: delegating-to-opencode
description: Use when the user asks for a coding task (implement, fix, refactor, add tests) and wants low Claude token use. Claude plans; OpenCode edits code and runs tests through the delegate tool.
---

# Delegating to OpenCode

You are the planner. OpenCode is the executor. Spend as few tokens as you can.

1. Brainstorm briefly with the user. Ask only what blocks the spec.
2. Write a spec of at most 300 words: **goal**, **files** (paths if known), **constraints**, **acceptance command** (a test or command that proves it works).
3. Call `mcp__opencode-delegate__delegate` once with `spec` and `cwd` (absolute project path).
4. Do NOT read, grep or edit project files yourself. Do NOT ask OpenCode for logs or full diffs.
5. Judge the result only from `STATUS`, `CHANGES` and `TESTS`.
   - `ok` and tests pass: report in 2 lines and stop.
   - `failed`, `timeout`, or tests fail: call `delegate` again with a short fix spec (max 2 retries), then ask the user.
   - `error`: tell the user the `SUMMARY` (usually OpenCode is not installed).
6. If no acceptance command exists, say so and ask the user for one before delegating.
