import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const sourcePath = new URL("../src/admin/admin-ui-primitives.jsx", import.meta.url);
const stylesPath = new URL("../src/admin/admin-foundation.css", import.meta.url);

test("AdminDialog uses native modal semantics, unique IDs, and one close-request boundary", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /const headingId = useId\(\)/);
  assert.match(source, /const descriptionId = useId\(\)/);
  assert.match(source, /dialog\.showModal\(\)/);
  assert.match(source, /aria-labelledby=\{headingId\}/);
  assert.match(source, /aria-describedby=\{description \? descriptionId : undefined\}/);
  assert.match(source, /onRequestClose\?\.\("escape"\)/);
  assert.match(source, /onRequestClose\?\.\("backdrop"\)/);
  assert.match(source, /initialFocusRef\?\.current \?\? fallbackFocusRef\.current/);
});

test("Admin foundation contains scoped focus, nested-scroll, and reduced-motion safeguards", async () => {
  const styles = await readFile(stylesPath, "utf8");
  assert.match(styles, /\.authenticated-admin-app/);
  assert.match(styles, /\.admin-dialog button:focus-visible/);
  assert.match(styles, /overscroll-behavior: contain/);
  assert.match(styles, /@media \(prefers-reduced-motion: reduce\)/);
  assert.doesNotMatch(styles, /transition:\s*all/);
});

test("AdminPagination derives a safe result range and exposes busy disabled controls", async () => {
  const source = await readFile(sourcePath, "utf8");
  assert.match(source, /rangeStart = validTotal === 0 \? 0/);
  assert.match(source, /Math\.min\(validPage \* validPageSize, validTotal\)/);
  assert.match(source, /Hiển thị <strong>\{rangeStart\}–\{rangeEnd\}<\/strong> \/ \{validTotal\} kết quả/);
  assert.match(source, /aria-label="Phân trang"/);
  assert.match(source, /disabled=\{busy \|\| validPage <= 1\}/);
  assert.match(source, /disabled=\{busy \|\| validPage >= validPages\}/);
});
