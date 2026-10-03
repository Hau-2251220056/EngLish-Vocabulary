import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  privateVocabularyFormValues,
  serializePrivateVocabulary,
  validatePrivateVocabulary,
} from "../src/vocabulary-sets/private-vocabulary-form-model.js";

test("private form pre-fills searched word and enforces required V1 fields", () => {
  const values = privateVocabularyFormValues({ word: "book" });
  assert.equal(values.word, "book");
  assert.equal(values.meanings.length, 1);
  assert.deepEqual(validatePrivateVocabulary(values), {
    "part-0": "Loại từ là bắt buộc.",
    "meaning-0": "Nghĩa tiếng Việt là bắt buộc.",
  });
  assert.equal(validatePrivateVocabulary({ ...values, word: " " }).word, "Từ vựng là bắt buộc.");
  assert.equal(validatePrivateVocabulary({ ...values, meanings: [] }).meanings, "Cần ít nhất một nghĩa.");
});

test("private form preserves and serializes multiple Meanings and nested Examples", () => {
  const aggregate = {
    id: "vocabulary-1", word: "book", phonetic: null,
    meanings: [
      { id: "meaning-1", part_of_speech: "noun", meaning_vi: "sách", context: "reading", cefr_level: "A1", examples: [{ id: "example-1", example_en: "A book", example_vi: "Một quyển sách" }] },
      { id: "meaning-2", part_of_speech: "verb", meaning_vi: "đặt chỗ", context: null, cefr_level: null, examples: [] },
    ],
  };
  const values = privateVocabularyFormValues(aggregate);
  assert.equal(values.meanings.length, 2);
  assert.equal(values.meanings[0].examples.length, 1);
  assert.deepEqual(validatePrivateVocabulary(values), {});
  assert.deepEqual(serializePrivateVocabulary(values), {
    word: "book", phonetic: null, meanings: aggregate.meanings,
  });
});

test("blank nested Example is rejected before backend submission", () => {
  const values = privateVocabularyFormValues({
    word: "book",
    meanings: [{ part_of_speech: "noun", meaning_vi: "sách", examples: [{ example_en: "", example_vi: "" }] }],
  });
  assert.equal(
    validatePrivateVocabulary(values)["example-0-0"],
    "Ví dụ tiếng Anh là bắt buộc.",
  );
});

test("edit dialog warns about shared identity without claiming a Set count or exposing internal fields", async () => {
  const source = await readFile(new URL("../src/vocabulary-sets/private-vocabulary-editor.jsx", import.meta.url), "utf8");
  assert.match(source, /Thay đổi này sẽ áp dụng cho mọi bộ từ đang sử dụng cùng từ vựng này/);
  assert.doesNotMatch(source, /\d+ bộ từ/);
  for (const forbidden of ["operation_id", "owner_id", "pronunciation_url", "fingerprint"]) {
    assert.doesNotMatch(source, new RegExp(forbidden));
  }
  assert.match(source, /dialog\?\.showModal\(\)/);
  assert.match(source, /<dialog ref=\{dialogRef\}/);
  assert.match(source, /private-vocabulary-embedded/);
  assert.match(source, /disabled=\{pending\}/);
});
