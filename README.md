# opencode-delegate

Claude Code plugin. Claude brainstorms and writes a compact spec. OpenCode does the work. Claude gets back a result capped at about 700 tokens (`STATUS`, `SUMMARY`, `CHANGES`, `TESTS`).

## Requirements
- Node 20+
- [OpenCode](https://opencode.ai) installed, with a model configured. Check with `opencode run "say ok"`.
- Mac, Linux or Windows (see [Windows](#windows) for one limitation)

## Install
In Claude Code:
```
/plugin marketplace add yashgajera04/claude-opencode
/plugin install opencode-delegate@opencode-delegate-local
```
Then restart Claude Code.

## Update
New releases bump the plugin version. To get them:
```
/plugin marketplace update opencode-delegate-local
```

## Use
```
/opencode-delegate:delegate add a hello() function in hello.py with a pytest test
```
The tool Claude calls is `mcp__plugin_opencode-delegate_opencode-delegate__delegate`.

## Security: read before allowlisting
`delegate` lets OpenCode edit files and run shell commands in any directory you give it. That runs **outside Claude Code's own permission rules and sandbox**, including your Bash deny rules. If you allowlist the tool so it never prompts, a prompt injection in a file or web page that Claude reads could make Claude call it with a malicious spec. Recommended: leave it on "ask" so you see each `spec` and `cwd`, and only allowlist it in projects you trust. `OPENCODE_DELEGATE_AUTO=1` makes OpenCode auto-approve its own permission requests, so use it only inside a throwaway or sandboxed checkout.

## Environment variables
| Variable | Default | Meaning |
|---|---|---|
| `OPENCODE_DELEGATE_MODEL` | OpenCode default | `provider/model` passed to `opencode run --model` |
| `OPENCODE_DELEGATE_TIMEOUT_S` | `600` | Kill OpenCode after this many seconds |
| `OPENCODE_DELEGATE_AUTO` | off | `1` passes `--auto` (auto-approves permissions; dangerous) |
| `OPENCODE_DELEGATE_BIN` | `opencode` | Path to the opencode binary |

## Windows
- The npm install of OpenCode only puts an `opencode.cmd` shim on PATH. The plugin never runs the spec through `cmd.exe`, because that would allow command injection. It finds the real `opencode.exe` instead: on PATH, or behind the npm shim. If it still reports "opencode binary not found", set `OPENCODE_DELEGATE_BIN` to the full path of `opencode.exe`.
- Timeout, cancel and closing Claude Code kill OpenCode and everything it started. One limitation: if OpenCode finishes normally but leaves a background process running (a dev server, a watcher), that process is not stopped on Windows. Mac and Linux stop it.

## Develop
```bash
npm install && npm test && npm run build   # build bundles dist/server.js (committed)
```
