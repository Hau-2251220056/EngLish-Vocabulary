import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const files = {
  primitive: "../src/components/native-select.jsx",
  discovery: "../src/topics/topic-list-page.jsx",
  progress: "../src/learning-progress/learning-progress-page.jsx",
  mySets: "../src/vocabulary-sets/my-vocabulary-sets-page.jsx",
  metadata: "../src/vocabulary-sets/vocabulary-set-metadata-controls.jsx",
  privateVocabulary: "../src/vocabulary-sets/private-vocabulary-editor.jsx",
  adminSets: "../src/vocabulary-sets/admin-vocabulary-sets-page.jsx",
  adminVocabulary: "../src/vocabulary/admin-vocabulary-route.jsx",
};

async function source(name) {
  return readFile(new URL(files[name], import.meta.url), "utf8");
}

test("NativeSelect keeps one native control and a pointer-transparent decorative chevron", async () => {
  const primitive = await source("primitive");
  assert.match(primitive, /<select className=/);
  assert.match(primitive, /appearance-none/);
  assert.match(primitive, /<ChevronDown/);
  assert.match(primitive, /pointer-events-none/);
  assert.match(primitive, /aria-hidden="true"/);
  assert.match(primitive, /focusable="false"/);
  assert.doesNotMatch(primitive, /role="(?:combobox|listbox|option)"/);
});

test("exactly the five approved USER surfaces opt into NativeSelect", async () => {
  const approvedSources = await Promise.all([
    source("discovery"),
    source("progress"),
    source("mySets"),
    source("metadata"),
    source("privateVocabulary"),
  ]);
  assert.ok(approvedSources.every((content) => content.includes("NativeSelect")));
  assert.match(approvedSources[2], /<VocabularySetCefrControl[^>]*userPresentation/);
  assert.match(approvedSources[3], /userPresentation\s*\?\s*<NativeSelect/);
});

test("ADMIN Set and Vocabulary surfaces do not import or render NativeSelect", async () => {
  for (const name of ["adminSets", "adminVocabulary"]) {
    const content = await source(name);
    assert.doesNotMatch(content, /NativeSelect/);
  }
  const metadata = await source("metadata");
  assert.match(metadata, /:\s*<select className=\{FIELD_CLASSES\}/);
});
