import { existsSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const prismaClientDir = join(process.cwd(), "node_modules", ".prisma", "client");
const stableEnginePath = join(prismaClientDir, "query_engine-windows.dll.node");
const generatedClientIndexPath = join(prismaClientDir, "index.js");
const prismaCliPath = join(process.cwd(), "node_modules", "prisma", "build", "index.js");

function cleanupTempEngines() {
  if (!existsSync(prismaClientDir)) return;

  for (const name of readdirSync(prismaClientDir)) {
    if (name.startsWith("query_engine-windows.dll.node.tmp")) {
      const tempPath = join(prismaClientDir, name);
      try {
        rmSync(tempPath, { force: true });
      } catch {
        // Ignore temp cleanup failures; the retry below will decide the outcome.
      }
    }
  }
}

function runGenerate() {
  if (existsSync(prismaCliPath)) {
    return spawnSync(process.execPath, [prismaCliPath, "generate"], {
      stdio: "pipe",
      encoding: "utf8",
      shell: false,
    });
  }

  return spawnSync(process.platform === "win32" ? "npx.cmd" : "npx", ["prisma", "generate"], {
    stdio: "pipe",
    encoding: "utf8",
    shell: false,
  });
}

cleanupTempEngines();

if (existsSync(stableEnginePath) && existsSync(generatedClientIndexPath)) {
  console.log("[prisma-safe] Existing Prisma client detected. Skipping forced regenerate.");
  process.exit(0);
}

const result = runGenerate();
if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
if (result.status === 0) {
  process.exit(0);
}

const stderr = String(result.stderr || "");
const stdout = String(result.stdout || "");
const combinedOutput = `${stdout}\n${stderr}`;
const hasWindowsLockError =
  combinedOutput.includes("EPERM: operation not permitted, rename") ||
  combinedOutput.includes("query_engine-windows.dll.node.tmp");

if (hasWindowsLockError && existsSync(stableEnginePath)) {
  cleanupTempEngines();
  console.warn(
    "[prisma-safe] Prisma generate hit a Windows file lock, but an existing client is already available. Continuing without crashing.",
  );
  process.exit(0);
}

process.exit(result.status ?? 1);
