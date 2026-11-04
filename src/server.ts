#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { delegate, MAX_SPEC_CHARS } from "./delegate.js";
import { killAllRunning } from "./runner.js";

const server = new McpServer({ name: "opencode-delegate", version: "0.1.2" });

server.registerTool(
  "delegate",
  {
    description:
      "Hand a coding task to OpenCode, which reads, edits and tests the code. " +
      "Returns only STATUS, SUMMARY, CHANGES (files changed during the run) and TESTS, capped at ~700 tokens. " +
      "Write the spec as: goal, files, constraints, and an acceptance command.",
    inputSchema: {
      spec: z.string().min(1).max(MAX_SPEC_CHARS).describe("Compact task spec for OpenCode"),
      cwd: z.string().describe("Absolute path of the project directory to work in"),
    },
  },
  async ({ spec, cwd }, extra) => {
    try {
      const text = await delegate({ spec, cwd }, process.env, extra.signal);
      return { content: [{ type: "text", text }] };
    } catch (e) {
      return { content: [{ type: "text", text: `STATUS: error\nSUMMARY: ${(e as Error).message}` }], isError: true };
    }
  },
);

// Stop OpenCode when Claude Code goes away, so it never edits a repo unsupervised.
const shutdown = () => {
  killAllRunning();
  setTimeout(() => process.exit(0), 100).unref();
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
process.stdin.on("end", shutdown);

await server.connect(new StdioServerTransport());
