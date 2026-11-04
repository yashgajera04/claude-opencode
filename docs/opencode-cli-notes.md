# OpenCode CLI contract (verified 2026-11-04, opencode 1.18.32)

- Invoke: `opencode run [message..] [--model provider/model] [--dir <path>]`
- `--format default` prints plain text. The final answer goes to **stdout**.
  Progress header (`> build · <model>`) goes to **stderr**.
- Exit code 0 on success.
- Permissions: `--auto` auto-approves everything not explicitly denied (dangerous).
  The plugin does not pass it unless env `OPENCODE_DELEGATE_AUTO=1` is set.
- The plugin always passes `--dir <cwd>` and sets `PWD`. A real run showed opencode ignores the
  spawn `cwd` and edits the caller's directory otherwise.
- The spec is passed after `--` (verified: a spec starting with `- ` is parsed as flags and prints
  help without it).
- Without `--auto`, opencode 1.18 auto-rejects permission requests and prints that to stderr
  rather than hanging. The plugin shows stderr when it matches reject/denied/permission.
