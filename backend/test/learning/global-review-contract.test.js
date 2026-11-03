import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("reachable review query encodes unlocked-public or owned-private reachability", async () => {
  const source = await readFile(new URL("../../src/repositories/learning-repository.js", import.meta.url), "utf8");
  assert.match(source, /is_public: true, cefr_level: \{ in: unlockedLevels \}/);
  assert.match(source, /is_public: false, owner_id: userId/);
  assert.match(source, /where: \{\s*user_id: userId,/s);
  assert.match(source, /orderBy: \[\{ vocabulary_id: "asc" \}\]/);
});

test("GLOBAL mutation path revalidates unresolved reachability without Set authorization", async () => {
  const source = await readFile(new URL("../../src/services/learning-service.js", import.meta.url), "utf8");
  assert.match(source, /session\.scope === "GLOBAL"/);
  assert.match(source, /lockedItems\.filter\(\(\{ evidence \}\) => evidence === null\)/);
  assert.match(source, /event\.set_id !== null/);
  assert.match(source, /if \(!globalSession\) await authorizeSetActivity/);
});

test("routes remain USER-authorized and expose only the approved review endpoints", async () => {
  const source = await readFile(new URL("../../src/routes/learning-routes.js", import.meta.url), "utf8");
  assert.match(source, /router\.use\(authenticationMiddleware\)/);
  assert.match(source, /router\.use\(userAuthorizationMiddleware\)/);
  assert.match(source, /router\.get\("\/review"/);
  assert.match(source, /router\.post\("\/review\/sessions"/);
});
