import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("public data-sources page preserves scoped attribution and limitations", async () => {
  const source = await readFile(new URL("../src/data-sources/data-sources-page.jsx", import.meta.url), "utf8");
  assert.match(source, /CEFR-J Wordlist v1\.6/);
  assert.match(source, /Octanove Vocabulary Profile v1\.0/);
  assert.match(source, /CC BY-SA 4\.0/);
  assert.match(source, /CMU Pronouncing Dictionary/);
  assert.match(source, /ipa-dict/);
  assert.match(source, /211 trường hợp IPA cần thêm bằng chứng/);
  assert.match(source, /elvocab-octanove-derived-c1\.csv/);
  assert.match(source, /đúng 145 mục Octanove-derived/);
  assert.match(source, /không áp dụng cho toàn bộ ứng dụng/);
  assert.doesNotMatch(source, /FileCheck2|lucide-file-check|text-\[clamp\(2rem,6vw,3\.5rem\)\]/);
});

test("Landing footer keeps approved links and removes only guest Explore", async () => {
  const source = await readFile(new URL("../src/landing/landing-page.jsx", import.meta.url), "utf8");
  const footerNavigation = source.match(/<nav[^>]*aria-label="Liên kết cuối trang"[\s\S]*?<\/nav>/)?.[0];
  assert.ok(footerNavigation);
  assert.match(footerNavigation, /to="\/data-sources"[^>]*>Nguồn dữ liệu &amp; Giấy phép/);
  assert.match(footerNavigation, /to="\/login"[^>]*>Đăng nhập/);
  assert.match(footerNavigation, /to="\/register"[^>]*>Đăng ký/);
  assert.doesNotMatch(footerNavigation, /to="\/topics"|Khám phá bộ từ/);
});

test("shared public header reuses Landing branding and deterministic navigation", async () => {
  const [layout, shell, css] = await Promise.all([
    "../src/topics/public-topic-layout.jsx",
    "../src/auth/ui/authenticated-shell.jsx",
    "../src/index.css",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  assert.match(layout, /assets\/images\/logo\.png/);
  assert.match(layout, /assets\/logo_mobile\.png/);
  assert.match(layout, /aria-label="Trang chủ ELVocab"/);
  assert.match(layout, /to="\/"[\s\S]*Trang chủ/);
  assert.match(layout, /to="\/login"[\s\S]*Đăng nhập/);
  assert.doesNotMatch(layout, /BookOpen|public-topic-brand-mark|public-topic-heading-mark|to="\/topics"/);
  assert.match(shell, /to="\/data-sources"/);
  const publicStyles = css.slice(css.indexOf(".public-topic-app"), css.indexOf(".authenticated-brand-mark"));
  assert.doesNotMatch(publicStyles, /#4f46e5|#4338ca|#3730a3|#a5b4fc|224 231 255/i);
});

test("Octanove download is isolated, complete, and accompanied by license notices", async () => {
  const [csv, attribution, ccLicense, cmuLicense] = await Promise.all([
    "../public/data-sources/elvocab-octanove-derived-c1.csv",
    "../public/data-sources/ATTRIBUTION.md",
    "../public/data-sources/CC-BY-SA-4.0.txt",
    "../public/data-sources/CMUDICT-LICENSE.txt",
  ].map((path) => readFile(new URL(path, import.meta.url), "utf8")));
  const lines = csv.trimEnd().split("\n");
  assert.equal(lines.length, 146);
  assert.match(lines[0], /"record_id","headword","part_of_speech","cefr_level"/);
  assert.doesNotMatch(lines[0], /phonetic|ipa/i);
  assert.ok(lines.slice(1).every((line) => line.includes('"Octanove Vocabulary Profile"')));
  assert.match(attribution, /exactly 145 C1 entries/);
  assert.match(attribution, /does not\s+purport to license the entire ELVocab application/);
  assert.match(ccLicense, /Attribution-ShareAlike 4\.0 International/);
  assert.match(cmuLicense, /Carnegie Mellon University/);
});
