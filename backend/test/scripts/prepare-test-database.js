import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { configureTestEnvironment } from "../helpers/test-environment.js";

try {
  configureTestEnvironment({ requireReset: true });
  const prismaCli = fileURLToPath(
    new URL("../../node_modules/prisma/build/index.js", import.meta.url),
  );
  const exitCode = await run(process.execPath, [prismaCli, "migrate", "deploy"]);
  process.exitCode = exitCode;
} catch (error) {
  console.error(`Test database preparation refused: ${error.message}`);
  process.exitCode = 1;
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: fileURLToPath(new URL("../..", import.meta.url)),
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}
