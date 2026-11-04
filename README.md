# opencode-delegate

Claude Code plugin. Claude brainstorms and writes a compact spec. OpenCode does the work. Claude gets back a result capped at about 700 tokens (`STATUS`, `SUMMARY`, `CHANGES`, `TESTS`).

## Requirements
- Node 20+
- `opencode` on your PATH, with a model configured

## Install
Try without installing:
```bash
claude --plugin-dir /path/to/claude-opencode-delegate
```
Install permanently:
```
/plugin marketplace add /path/to/claude-opencode-delegate
/plugin install opencode-delegate@opencode-delegate-local
```

## Use
```
/opencode-delegate:delegate add a hello() function in hello.py with a pytest test
```
The tool Claude calls is `mcp__plugin_opencode-delegate_opencode-delegate__delegate`. To skip permission prompts, allow that name in your settings.

## Environment variables
| Variable | Default | Meaning |
|---|---|---|
| `OPENCODE_DELEGATE_MODEL` | OpenCode default | `provider/model` passed to `opencode run --model` |
| `OPENCODE_DELEGATE_TIMEOUT_S` | `600` | Kill OpenCode after this many seconds |
| `OPENCODE_DELEGATE_AUTO` | off | `1` passes `--auto` (auto-approves permissions; dangerous) |
| `OPENCODE_DELEGATE_BIN` | `opencode` | Path to the opencode binary |

## Develop
```bash
npm install && npm test && npm run build   # build bundles dist/server.js (committed)
```
