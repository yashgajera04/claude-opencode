#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { delegate, MAX_SPEC_CHARS } from "./delegate.js";
const server = new McpServer({ name: "opencode-delegate", version: "0.1.0" });
server.registerTool("delegate", {
    description: "Hand a coding task to OpenCode, which reads, edits and tests the code. " +
        "Returns only STATUS, SUMMARY, CHANGES (git diff --stat) and TESTS, capped at ~700 tokens. " +
        "Write the spec as: goal, files, constraints, and an acceptance command.",
    inputSchema: {
        spec: z.string().min(1).max(MAX_SPEC_CHARS).describe("Compact task spec for OpenCode"),
        cwd: z.string().describe("Absolute path of the project directory to work in"),
    },
}, async ({ spec, cwd }) => {
    try {
        const text = await delegate({ spec, cwd }, process.env);
        return { content: [{ type: "text", text }] };
    }
    catch (e) {
        return { content: [{ type: "text", text: `STATUS: error\nSUMMARY: ${e.message}` }], isError: true };
    }
});
await server.connect(new StdioServerTransport());
