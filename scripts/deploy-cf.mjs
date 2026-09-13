import { spawnSync } from "node:child_process";
import { existsSync, renameSync } from "node:fs";

const apiDir = new URL("../app/api", import.meta.url);
const apiHidden = new URL("../app/_api_hidden", import.meta.url);

function run(command, args, extraEnv = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: { ...process.env, ...extraEnv },
  });
  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

const moved = existsSync(apiDir);
if (moved) renameSync(apiDir, apiHidden);

try {
  run("npx", ["next", "build"], { WORKER_BUILD: "1" });
} finally {
  if (moved && existsSync(apiHidden)) renameSync(apiHidden, apiDir);
}

run("npx", [
  "wrangler",
  "pages",
  "deploy",
  "out",
  "--project-name",
  "coderollson",
  "--branch",
  "master",
  "--commit-dirty=true",
]);
