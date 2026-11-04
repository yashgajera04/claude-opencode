// Fake `opencode` for tests, run under Node so it works on every OS.
// Behaviour is chosen with FAKE_MODE.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";

const out = (s) => process.stdout.write(s + "\n");
const err = (s) => process.stderr.write(s + "\n");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

switch (process.env.FAKE_MODE) {
  case "ok":
    out("done: changed 1 file");
    break;
  case "fail":
    err("boom happened");
    process.exitCode = 1;
    break;
  case "sleep":
    await sleep(10_000);
    break;
  case "big": {
    const chunk = "x".repeat(64 * 1024);
    for (let i = 0; i < 80; i++) process.stdout.write(chunk); // 5 MB
    out("");
    out("final line");
    break;
  }
  case "touch":
    await sleep(2000);
    writeFileSync(process.env.FAKE_FILE, "");
    out("done");
    break;
  case "bg": {
    // A background child that outlives us and keeps our stdout/stderr open.
    const code = `setTimeout(() => require("fs").writeFileSync(${JSON.stringify(process.env.FAKE_FILE)}, ""), 2000)`;
    spawn(process.execPath, ["-e", code], { stdio: "inherit" }).unref();
    out("All done");
    process.exit(0);
  }
  case "failbig":
    for (let i = 1; i <= 300; i++) out(`line ${i} of noisy output xxxxxxxxxx`);
    for (let i = 1; i <= 100; i++) err(`stderr noise ${i} yyyyyyyyyy`);
    process.exitCode = 1;
    break;
  case "silent":
    err("permission requested: bash (rm) auto-rejecting");
    break;
  case "tests":
    out("implemented hello()");
    out("3 passed, 0 failed");
    break;
  case "args":
    for (const a of process.argv.slice(2)) out(`ARG:${a}`);
    break;
  default:
    err("unknown mode");
    process.exitCode = 2;
}
