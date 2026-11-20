import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import process from "node:process";
import test from "node:test";

const configUrl = new URL("../vercel.mjs", import.meta.url);

function evaluateConfig(target) {
  const environment = { ...process.env };
  if (target === undefined) delete environment.API_PROXY_TARGET;
  else environment.API_PROXY_TARGET = target;

  return spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "--eval",
      `import(${JSON.stringify(configUrl.href)})`
        + ".then(({ config }) => process.stdout.write(JSON.stringify(config)))",
    ],
    { encoding: "utf8", env: environment },
  );
}

test("Vercel helper keeps environment-selected API rewrites ahead of the frontend SPA fallback", () => {
  const result = evaluateConfig("https://backend.example.test/");
  assert.equal(result.status, 0, result.stderr);
  const config = JSON.parse(result.stdout);

  assert.equal(config.rewrites[0].source, "/api/:path*");
  assert.equal(config.rewrites[0].destination, "https://backend.example.test/api/:path*");
  assert.deepEqual(config.rewrites[1], { source: "/:path*", destination: "/index.html" });
});

test("Vercel routing accepts safe HTTPS origins with or without a trailing slash", () => {
  for (const target of ["https://backend.example.test", "https://backend.example.test/"]) {
    const result = evaluateConfig(target);
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(result.stdout);
    assert.equal(config.rewrites[0].destination, "https://backend.example.test/api/:path*");
  }
});

test("Vercel routing fails closed for missing or unsafe API proxy targets", () => {
  const invalidTargets = [
    undefined,
    "",
    "   ",
    " https://backend.example.test",
    "http://backend.example.test",
    "not a URL",
    "https://user@backend.example.test",
    "https://user:password@backend.example.test",
    "https://backend.example.test?environment=preview",
    "https://backend.example.test#preview",
    "https://backend.example.test/api",
    "ftp://backend.example.test",
    "data:text/plain,backend",
  ];

  for (const target of invalidTargets) {
    const result = evaluateConfig(target);
    assert.notEqual(result.status, 0, `Unexpectedly accepted ${String(target)}`);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /API_PROXY_TARGET/);
  }
});

test("active Vercel routing contains no hardcoded deployment destination or fallback", async () => {
  const source = await readFile(configUrl, "utf8");
  assert.match(source, /import \{ routes \} from "@vercel\/config\/v1"/);
  assert.equal(source.match(/routes\.rewrite\(/g)?.length, 2);
  assert.doesNotMatch(source, /vercel\.app/i);
  assert.doesNotMatch(source, /git-dev/i);
  assert.doesNotMatch(source, /git-release/i);
  assert.doesNotMatch(source, /eng-lish-vocabulary/i);
  assert.match(source, /process\.env\.API_PROXY_TARGET/);
  assert.doesNotMatch(source, /localhost:5000/);
});
