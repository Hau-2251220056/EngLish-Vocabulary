import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Dashboard keeps CEFR loading independent and preserves ADMIN neutrality", async () => {
  const source = await readFile(new URL("../src/dashboard/dashboard-page.jsx", import.meta.url), "utf8");
  assert.match(source, /useDashboardSource\(isUser, loadLearningPath, "learning-path"\)/);
  assert.match(source, /if \(!isUser\) return <DashboardAdminLanding/);
  assert.match(source, /path\.highest_unlocked_level/);
  assert.match(source, /Nội dung chưa học ở cấp trước/);
  assert.match(source, /learningPathAction: recommendation\.action/);
  assert.doesNotMatch(source, /sort\(.*recommendation/s);
});

test("NORMAL full-pass UI requires explicit final completion and truthful restart", async () => {
  const source = await readFile(new URL("../src/learning/learning-foundation-page.jsx", import.meta.url), "utf8");
  assert.match(source, /learningPathService\.createNextSession/);
  assert.match(source, /learningPathService\.completePass/);
  assert.match(source, /Hoàn thành bộ từ/);
  assert.match(source, /CEFR_PASS_RESTART_REQUIRED/);
  assert.match(source, /pathPass\.remaining_items === 0/);
  assert.match(source, /location\.state\?\.learningPathAction/);
});

test("changed controls retain semantic, focus, and reduced-motion conventions", async () => {
  const dashboard = await readFile(new URL("../src/dashboard/dashboard-page.jsx", import.meta.url), "utf8");
  const learning = await readFile(new URL("../src/learning/learning-foundation-page.jsx", import.meta.url), "utf8");
  assert.match(dashboard, /<details/);
  assert.match(dashboard, /<summary className="min-h-11 cursor-pointer/);
  assert.match(dashboard, /<span className="sr-only">\{level\.unlocked/);
  assert.match(learning, /disabled=\{eventState === "pending"\}/);
  assert.match(learning, /motion-reduce:transition-none/);
});
