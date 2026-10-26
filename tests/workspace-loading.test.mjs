/* eslint-env node */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import test from "node:test";

test("branded workspace loading hydrates, retires immediately, and exposes startup failures", async () => {
  const { stdout } = await promisify(execFile)(process.execPath, [
    fileURLToPath(new URL("../node_modules/vite-node/vite-node.mjs", import.meta.url)),
    "app/dev/workspace-loading-probe.mjs",
  ], { cwd: fileURLToPath(new URL("..", import.meta.url)), timeout: 30000 });
  assert.match(stdout, /Workspace loading:.*passed/);
});
