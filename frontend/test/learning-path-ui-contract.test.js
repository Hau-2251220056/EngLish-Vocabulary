import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Dashboard separates next suggestion, CEFR, review, featured Sets, and preserves ADMIN neutrality", async () => {
  const source = await readFile(new URL("../src/dashboard/dashboard-page.jsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../src/dashboard/dashboard-page.css", import.meta.url), "utf8");
  const shell = await readFile(new URL("../src/auth/ui/authenticated-shell.jsx", import.meta.url), "utf8");
  assert.match(source, /useDashboardSource\(isUser, loadLearningPath, "learning-path"\)/);
  assert.match(source, /if \(!isUser\) return <DashboardAdminLanding/);
  assert.match(source, /path\.highest_unlocked_level/);
  assert.match(source, /Gợi ý tiếp theo/);
  assert.match(source, /const suggestion = path\.next_suggestion/);
  assert.match(source, /findRecommendedSet\(path, suggestion\.set_id\)/);
  assert.match(source, /learningPathAction: suggestion\.action/);
  assert.doesNotMatch(source, /path\.recommendation/);
  assert.match(source, /title="Lộ trình CEFR" type="learning-path"/);
  assert.match(source, /title="Từ cần ôn" type="review"/);
  assert.match(source, /loadDiscoveryCatalog/);
  assert.match(source, /selectDiscoveryFeaturedSets/);
  assert.match(source, /Bộ từ nổi bật/);
  assert.match(source, /grid-cols-4[\s\S]*<LevelStat[\s\S]*<StreakStat[\s\S]*<TotalXpStat[\s\S]*<SetCountStat/);
  assert.match(source, /#DBEAFE/);
  assert.match(source, /#FFEDD5/);
  assert.match(source, /#CFFAFE/);
  assert.match(source, /#D1FAE5/);
  assert.match(source, /data\.completed_today \? "border-orange-200 bg-orange-100 text-\[#d94a1e\]" : "border-slate-200 bg-slate-100 text-slate-400"/);
  assert.match(source, />\{suggestedSet\.level\}<\/span>/);
  assert.doesNotMatch(source, /aria-label="Làm mới chuỗi học tập"/);
  assert.match(shell, /isDashboard \? " dashboard-shell lg:!min-h-0"/);
  assert.doesNotMatch(shell, /dashboard-scrollbar/);
  assert.match(styles, /html:has\(\.authenticated-user-app\.dashboard-shell\)[\s\S]*scrollbar-color: #2f86bd #edf3f6/);
  assert.match(styles, /\.authenticated-user-app\.dashboard-shell \.authenticated-main[\s\S]*overflow: visible !important/);
  assert.match(source, /<span className="block text-\[0\.62em\][^>]*>\{greeting\}\{" "\}<\/span><span className="mt-1 block/);
  assert.doesNotMatch(source, /DashboardSection|ProgressSummary|MySetsSummary|Bộ từ riêng xem trước/);
  assert.doesNotMatch(source, /Bài học hiện tại|current lesson|currentLesson/i);
  assert.doesNotMatch(source, /sort\(.*recommendation/s);
  assert.doesNotMatch(`${source}\n${styles}`, /purple|violet|indigo|lavender|#3b5bdb|#2946b4|#3451bd/i);
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
  assert.match(dashboard, /<span className="sr-only">\{level\.unlocked/);
  assert.match(dashboard, /role="progressbar"/);
  assert.match(dashboard, /motion-reduce:animate-none/);
  assert.match(dashboard, /min-h-11/);
  assert.match(dashboard, /focus-visible:ring-3/);
  assert.match(learning, /disabled=\{eventState === "pending"\}/);
  assert.match(learning, /motion-reduce:transition-none/);
});
