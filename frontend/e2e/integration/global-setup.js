import { spawn } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";

export default async function globalSetup() {
  configureTestEnvironment({ requireReset: true });

  const backendDirectory = fileURLToPath(
    new URL("../../../backend/", import.meta.url),
  );
  const prismaCli = fileURLToPath(
    new URL("../../../backend/node_modules/prisma/build/index.js", import.meta.url),
  );
  const exitCode = await run(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: backendDirectory,
  });

  if (exitCode !== 0) {
    throw new Error("Test database migration preparation failed.");
  }
}

function run(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      ...options,
      env: process.env,
      stdio: "inherit",
    });
    child.once("error", reject);
    child.once("exit", (code) => resolve(code ?? 1));
  });
}
