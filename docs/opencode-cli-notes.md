# OpenCode CLI contract (verified 2026-11-04, opencode 1.18.32)

- Invoke: `opencode run [message..] [--model provider/model] [--dir <path>]`
- `--format default` prints plain text. The final answer goes to **stdout**.
  Progress header (`> build · <model>`) goes to **stderr**.
- Exit code 0 on success.
- Permissions: `--auto` auto-approves everything not explicitly denied (dangerous).
  The plugin does not pass it unless env `OPENCODE_DELEGATE_AUTO=1` is set.
- The plugin sets the working directory with the spawn `cwd` option (not `--dir`).
