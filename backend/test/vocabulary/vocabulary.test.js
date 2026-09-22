import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, beforeEach, test } from "node:test";
import { createApp } from "../../src/create-app.js";
import {
  createSessionFixture,
  createUserFixture,
} from "../helpers/auth-fixtures.js";
import { createTestDatabase } from "../helpers/test-database.js";
import { startHttpTestServer } from "../helpers/http-test-server.js";

const ERROR_CODES = {
  validation: "VALIDATION_ERROR",
  missing: "VOCABULARY_NOT_FOUND",
  duplicate: "VOCABULARY_WORD_ALREADY_EXISTS",
};

let database;
let prisma;
let http;

before(async () => {
  database = await createTestDatabase();
  prisma = database.prisma;
  http = await startHttpTestServer(createApp({ prisma }));
});

beforeEach(async () => {
  await database.reset();
});

afterEach(async () => {
  await database.reset();
});

after(async () => {
  try {
    if (database) await database.reset();
  } finally {
    try {
      if (http) await http.close();
    } finally {
      if (database) await database.disconnect();
    }
  }
});

test("Vocabulary schema materializes only the approved owned aggregate and constraints", { concurrency: false }, async () => {
  const tables = await prisma.$queryRawUnsafe(
    `SELECT table_name
       FROM information_schema.tables
      WHERE table_schema = current_schema()
        AND table_name IN ('VOCABULARY', 'VOCABULARY_MEANING', 'VOCABULARY_EXAMPLE')
      ORDER BY table_name`,
  );
  assert.deepEqual(tables.map(({ table_name }) => table_name), [
    "VOCABULARY",
    "VOCABULARY_EXAMPLE",
    "VOCABULARY_MEANING",
  ]);

  const columns = await prisma.$queryRawUnsafe(
    `SELECT table_name, column_name, data_type, is_nullable, character_maximum_length
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name IN ('VOCABULARY', 'VOCABULARY_MEANING', 'VOCABULARY_EXAMPLE')
      ORDER BY table_name, ordinal_position`,
  );
  assert.deepEqual(
    columns.map(({ table_name, column_name }) => `${table_name}.${column_name}`),
    [
      "VOCABULARY.id",
      "VOCABULARY.word",
      "VOCABULARY.phonetic",
      "VOCABULARY.pronunciation_url",
      "VOCABULARY.created_at",
      "VOCABULARY.updated_at",
      "VOCABULARY_EXAMPLE.id",
      "VOCABULARY_EXAMPLE.meaning_id",
      "VOCABULARY_EXAMPLE.example_en",
      "VOCABULARY_EXAMPLE.example_vi",
      "VOCABULARY_EXAMPLE.created_at",
      "VOCABULARY_MEANING.id",
      "VOCABULARY_MEANING.vocabulary_id",
      "VOCABULARY_MEANING.part_of_speech",
      "VOCABULARY_MEANING.meaning_vi",
      "VOCABULARY_MEANING.context",
      "VOCABULARY_MEANING.cefr_level",
      "VOCABULARY_MEANING.created_at",
      "VOCABULARY_MEANING.updated_at",
    ],
  );
  assert.equal(
    columns.find((column) => column.column_name === "cefr_level").is_nullable,
    "YES",
  );
  assert.equal(
    columns.some((column) => column.column_name === "difficulty_level"),
    false,
  );

  const foreignKeys = await prisma.$queryRawUnsafe(
    `SELECT conname, pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
      WHERE conname IN ('VOCABULARY_MEANING_vocabulary_id_fkey', 'VOCABULARY_EXAMPLE_meaning_id_fkey')`,
  );
  assert.equal(foreignKeys.length, 2);
  for (const foreignKey of foreignKeys) {
    assert.match(foreignKey.definition, /ON DELETE CASCADE/i);
  }
});

test("database CEFR CHECK and LOWER(word) uniqueness enforce approved values", { concurrency: false }, async () => {
  const vocabularyId = randomUUID();
  await prisma.$executeRawUnsafe(
    `INSERT INTO "VOCABULARY" ("id", "word", "created_at", "updated_at")
     VALUES ($1::uuid, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    vocabularyId,
    "Database Vocabulary",
  );

  for (const [index, level] of ["A1", "A2", "B1", "B2", "C1", "C2", null].entries()) {
    await prisma.$executeRawUnsafe(
      `INSERT INTO "VOCABULARY_MEANING" ("id", "vocabulary_id", "part_of_speech", "meaning_vi", "cefr_level", "created_at", "updated_at")
       VALUES ($1::uuid, $2::uuid, 'noun', 'nghia', $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      randomUUID(),
      vocabularyId,
      level,
    );
    assert.equal(index >= 0, true);
  }
  await assert.rejects(
    prisma.$executeRawUnsafe(
      `INSERT INTO "VOCABULARY_MEANING" ("id", "vocabulary_id", "part_of_speech", "meaning_vi", "cefr_level", "created_at", "updated_at")
       VALUES ($1::uuid, $2::uuid, 'noun', 'nghia', 'Z9', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      randomUUID(),
      vocabularyId,
    ),
  );
  await assert.rejects(
    prisma.$executeRawUnsafe(
      `INSERT INTO "VOCABULARY" ("id", "word", "created_at", "updated_at")
       VALUES ($1::uuid, $2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      randomUUID(),
      "database vocabulary",
    ),
  );
});

test("ADMIN list is empty and no public or granular child Vocabulary API exists", { concurrency: false }, async () => {
  const cookie = await authenticatedCookie("ADMIN");
  assert.equal((await http.request("/api/auth/me", { cookie })).status, 200);
  const list = await adminRequest("/api/admin/vocabulary", cookie);
  assert.equal(list.status, 200);
  assert.deepEqual(list.json, { success: true, data: [] });

  assert.equal((await http.request("/api/vocabulary")).status, 404);
  for (const path of [
    `/api/admin/vocabulary/${randomUUID()}/meanings`,
    `/api/admin/vocabulary/${randomUUID()}/examples`,
  ]) {
    assert.equal((await adminRequest(path, cookie)).status, 404);
  }
});

test("ADMIN creates and retrieves a complete aggregate while list returns summaries", { concurrency: false }, async () => {
  const cookie = await authenticatedCookie("ADMIN");
  const created = await createVocabulary(cookie, {
    word: "  Book  ",
    phonetic: "/bʊk/",
    pronunciation_url: null,
    meanings: [
      {
        part_of_speech: " noun ",
        meaning_vi: " quyển sách ",
        context: null,
        cefr_level: "A1",
        examples: [
          { example_en: " This is a book. ", example_vi: "Đây là một quyển sách." },
        ],
      },
    ],
  });
  assert.equal(created.status, 201);
  const vocabulary = created.json.data;
  assert.equal(vocabulary.word, "Book");
  assert.equal(vocabulary.meanings[0].part_of_speech, "noun");
  assert.equal(vocabulary.meanings[0].meaning_vi, "quyển sách");
  assert.equal(vocabulary.meanings[0].examples[0].example_en, "This is a book.");
  assert.equal("vocabulary_id" in vocabulary.meanings[0], false);
  assert.equal("meaning_id" in vocabulary.meanings[0].examples[0], false);

  const list = await adminRequest("/api/admin/vocabulary", cookie);
  assert.equal(list.status, 200);
  assert.equal(list.json.data.length, 1);
  assert.equal("meanings" in list.json.data[0], false);

  const detail = await adminRequest(`/api/admin/vocabulary/${vocabulary.id}`, cookie);
  assert.equal(detail.status, 200);
  assert.deepEqual(detail.json.data, vocabulary);
});

test("create validation rejects invalid aggregate data without partial rows", { concurrency: false }, async () => {
  const cookie = await authenticatedCookie("ADMIN");
  const invalidPayloads = [
    {},
    { word: "Book", meanings: [] },
    { word: " ", meanings: validMeanings() },
    { word: "x".repeat(101), meanings: validMeanings() },
    { word: "Book", phonetic: "x".repeat(101), meanings: validMeanings() },
    { word: "Book", pronunciation_url: "x".repeat(2049), meanings: validMeanings() },
    { word: "Book", meanings: [{ ...validMeaning(), part_of_speech: " " }] },
    { word: "Book", meanings: [{ ...validMeaning(), meaning_vi: "x".repeat(501) }] },
    { word: "Book", meanings: [{ ...validMeaning(), context: "x".repeat(501) }] },
    { word: "Book", meanings: [{ ...validMeaning(), cefr_level: "Z9" }] },
    { word: "Book", meanings: [{ ...validMeaning(), examples: [{ example_en: " " }] }] },
    { word: "Book", meanings: [{ ...validMeaning(), examples: [{ example_en: "x".repeat(1001) }] }] },
    { word: "Book", meanings: [{ ...validMeaning(), examples: [{ example_en: "ok", example_vi: "x".repeat(1001) }] }] },
    { word: "Book", meanings: [{ ...validMeaning(), id: randomUUID() }] },
  ];

  for (const payload of invalidPayloads) {
    assertError(await createVocabulary(cookie, payload), 400, ERROR_CODES.validation);
  }
  assert.equal(await prisma.vOCABULARY.count(), 0);
  assert.equal(await prisma.vOCABULARY_MEANING.count(), 0);
  assert.equal(await prisma.vOCABULARY_EXAMPLE.count(), 0);
});

test("case-insensitive duplicate create, rename, and concurrent create use the stable 409 contract", { concurrency: false }, async () => {
  const cookie = await authenticatedCookie("ADMIN");
  const first = await createVocabulary(cookie, validPayload({ word: "Travel" }));
  assert.equal(first.status, 201);
  assertError(
    await createVocabulary(cookie, validPayload({ word: "tRaVeL" })),
    409,
    ERROR_CODES.duplicate,
  );
  const other = await createVocabulary(cookie, validPayload({ word: "Work" }));
  assertError(
    await adminRequest(`/api/admin/vocabulary/${other.json.data.id}`, cookie, {
      method: "PATCH",
      json: { word: "TRAVEL" },
    }),
    409,
    ERROR_CODES.duplicate,
  );

  await database.reset();
  const raceCookie = await authenticatedCookie("ADMIN");
  const responses = await Promise.all([
    createVocabulary(raceCookie, validPayload({ word: "Concurrent Word" })),
    createVocabulary(raceCookie, validPayload({ word: "concurrent word" })),
  ]);
  assert.deepEqual(
    responses.map(({ status }) => status).sort(),
    [201, 409],
  );
  assert.equal(
    responses.find(({ status }) => status === 409).json.error.code,
    ERROR_CODES.duplicate,
  );
  assert.equal(await prisma.vOCABULARY.count(), 1);
});

test("all ADMIN Vocabulary endpoints reject unauthenticated and USER callers", { concurrency: false }, async () => {
  const adminCookie = await authenticatedCookie("ADMIN");
  const created = await createVocabulary(adminCookie, validPayload());
  assert.equal(created.status, 201);
  const id = created.json.data.id;
  const paths = [
    ["/api/admin/vocabulary", { method: "GET" }],
    [`/api/admin/vocabulary/${id}`, { method: "GET" }],
    ["/api/admin/vocabulary", { method: "POST", json: validPayload({ word: "Blocked" }) }],
    [`/api/admin/vocabulary/${id}`, { method: "PATCH", json: { word: "Blocked" } }],
    [`/api/admin/vocabulary/${id}`, { method: "DELETE" }],
  ];
  for (const [path, options] of paths) {
    assertError(await http.request(path, options), 401, "AUTHENTICATION_FAILED");
  }

  const userCookie = await authenticatedCookie("USER");
  for (const [path, options] of paths) {
    assertError(
      await http.request(path, {
        ...options,
        cookie: userCookie,
        headers: { "x-role": "ADMIN", "x-user-id": "forged" },
      }),
      403,
      "FORBIDDEN",
    );
  }
  assert.equal(await prisma.vOCABULARY.count(), 1);
});

test("detail, PATCH, and delete reject invalid or missing Vocabulary identifiers safely", { concurrency: false }, async () => {
  const cookie = await authenticatedCookie("ADMIN");
  for (const [path, options, status] of [
    ["/api/admin/vocabulary/not-a-uuid", {}, 400],
    [`/api/admin/vocabulary/${randomUUID()}`, {}, 404],
    ["/api/admin/vocabulary/not-a-uuid", { method: "PATCH", json: { word: "Book" } }, 400],
    [`/api/admin/vocabulary/${randomUUID()}`, { method: "DELETE" }, 404],
  ]) {
    assertError(await adminRequest(path, cookie, options), status, status === 400 ? ERROR_CODES.validation : ERROR_CODES.missing);
  }
});

test("PATCH preserves omitted top-level fields, clears explicit nulls, and replaces owned collections", { concurrency: false }, async () => {
  const cookie = await authenticatedCookie("ADMIN");
  const created = await createVocabulary(cookie, {
    word: "Original",
    phonetic: "/old/",
    pronunciation_url: "https://example.test/old.mp3",
    meanings: [
      {
        part_of_speech: "noun",
        meaning_vi: "nghia mot",
        examples: [
          { example_en: "First." },
          { example_en: "Removed." },
        ],
      },
      { part_of_speech: "verb", meaning_vi: "nghia hai", examples: [] },
    ],
  });
  const original = created.json.data;
  const retainedMeaning = original.meanings[0];
  const retainedExample = retainedMeaning.examples[0];
  const update = await adminRequest(`/api/admin/vocabulary/${original.id}`, cookie, {
    method: "PATCH",
    json: {
      phonetic: null,
      pronunciation_url: null,
      meanings: [
        {
          id: retainedMeaning.id,
          part_of_speech: "noun",
          meaning_vi: "nghia da sua",
          context: null,
          cefr_level: "A2",
          examples: [
            { id: retainedExample.id, example_en: "Updated." },
            { example_en: "New." },
          ],
        },
      ],
    },
  });
  assert.equal(update.status, 200);
  assert.equal(update.json.data.word, "Original");
  assert.equal(update.json.data.phonetic, null);
  assert.equal(update.json.data.pronunciation_url, null);
  assert.equal(update.json.data.meanings.length, 1);
  assert.equal(update.json.data.meanings[0].id, retainedMeaning.id);
  assert.equal(update.json.data.meanings[0].examples.length, 2);
  assert.equal(update.json.data.meanings[0].examples[0].id, retainedExample.id);
  assert.equal(update.json.data.meanings[0].examples[0].example_en, "Updated.");
  assert.equal(await prisma.vOCABULARY_MEANING.count(), 1);
  assert.equal(await prisma.vOCABULARY_EXAMPLE.count(), 2);
});

test("PATCH rejects invalid bodies and leaves the aggregate unchanged", { concurrency: false }, async () => {
  const cookie = await authenticatedCookie("ADMIN");
  const created = await createVocabulary(cookie, validPayload({ word: "Patch Guard" }));
  const id = created.json.data.id;
  const invalidBodies = [
    {},
    { unsupported: true },
    { word: null },
    { phonetic: 12 },
    { pronunciation_url: "x".repeat(2049) },
    { meanings: [] },
    { meanings: [{ ...validMeaning(), examples: undefined }] },
  ];
  for (const json of invalidBodies) {
    assertError(
      await adminRequest(`/api/admin/vocabulary/${id}`, cookie, { method: "PATCH", json }),
      400,
      ERROR_CODES.validation,
    );
  }
  const stored = await prisma.vOCABULARY.findUnique({ where: { id } });
  assert.equal(stored.word, "Patch Guard");
  assert.equal(await prisma.vOCABULARY_MEANING.count(), 1);
});

test("PATCH rejects unknown, duplicate, cross-parent, and cross-aggregate child IDs atomically", { concurrency: false }, async () => {
  const cookie = await authenticatedCookie("ADMIN");
  const first = (await createVocabulary(cookie, {
    word: "First Aggregate",
    meanings: [
      { part_of_speech: "noun", meaning_vi: "one", examples: [{ example_en: "One." }] },
      { part_of_speech: "verb", meaning_vi: "two", examples: [{ example_en: "Two." }] },
    ],
  })).json.data;
  const second = (await createVocabulary(cookie, validPayload({ word: "Second Aggregate" }))).json.data;
  const firstMeaning = first.meanings[0];
  const otherMeaning = first.meanings[1];
  const otherAggregateMeaning = second.meanings[0];
  const unknownMeaning = randomUUID();
  const scenarios = [
    [{ ...meaningPayload(firstMeaning), id: unknownMeaning }],
    [meaningPayload(firstMeaning), meaningPayload(firstMeaning)],
    [{ ...meaningPayload(firstMeaning), examples: [{ id: otherMeaning.examples[0].id, example_en: "Wrong parent." }] }],
    [{ ...meaningPayload(otherAggregateMeaning), id: otherAggregateMeaning.id }],
  ];
  for (const meanings of scenarios) {
    assertError(
      await adminRequest(`/api/admin/vocabulary/${first.id}`, cookie, {
        method: "PATCH",
        json: { word: "Should Roll Back", meanings },
      }),
      400,
      ERROR_CODES.validation,
    );
    const stored = await prisma.vOCABULARY.findUnique({ where: { id: first.id } });
    assert.equal(stored.word, "First Aggregate");
  }
  assert.equal(await prisma.vOCABULARY_MEANING.count(), 3);
  assert.equal(await prisma.vOCABULARY_EXAMPLE.count(), 3);
});

test("delete removes only the Vocabulary aggregate and owned children", { concurrency: false }, async () => {
  const cookie = await authenticatedCookie("ADMIN");
  const created = await createVocabulary(cookie, validPayload({ word: "Delete Aggregate" }));
  const id = created.json.data.id;
  const deleted = await adminRequest(`/api/admin/vocabulary/${id}`, cookie, {
    method: "DELETE",
  });
  assert.equal(deleted.status, 204);
  assert.equal(deleted.text, "");
  assert.equal(await prisma.vOCABULARY.count(), 0);
  assert.equal(await prisma.vOCABULARY_MEANING.count(), 0);
  assert.equal(await prisma.vOCABULARY_EXAMPLE.count(), 0);
  assertError(
    await adminRequest(`/api/admin/vocabulary/${id}`, cookie),
    404,
    ERROR_CODES.missing,
  );
});

test("unexpected Vocabulary failures use the final safe 500 contract", { concurrency: false }, async () => {
  const sensitiveValues = ["database-credential-value", "session-secret-value", "stack trace"];
  const failingPrisma = {
    vOCABULARY: {
      findMany() {
        throw new Error(sensitiveValues.join(" | "));
      },
    },
  };
  const failingHttp = await startHttpTestServer(createApp({ prisma: failingPrisma }));
  try {
    const cookie = "session_id=not-used";
    const response = await failingHttp.request("/api/admin/vocabulary", { cookie });
    assert.equal(response.status, 500);
    assert.deepEqual(response.json, {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred.",
      },
    });
    for (const value of sensitiveValues) {
      assert.equal(response.text.includes(value), false);
    }
  } finally {
    await failingHttp.close();
  }
});

async function authenticatedCookie(role) {
  const user = await createUserFixture(prisma, {
    role,
    password_hash: "not-used-by-session-authentication",
  });
  const session = await createSessionFixture(prisma, user.id);
  return `session_id=${session.rawToken}`;
}

function createVocabulary(cookie, json) {
  return adminRequest("/api/admin/vocabulary", cookie, { method: "POST", json });
}

function adminRequest(path, cookie, options = {}) {
  return http.request(path, { ...options, cookie });
}

function validPayload(overrides = {}) {
  return {
    word: "Valid Word",
    meanings: validMeanings(),
    ...overrides,
  };
}

function validMeanings() {
  return [validMeaning()];
}

function validMeaning() {
  return {
    part_of_speech: "noun",
    meaning_vi: "nghia",
    examples: [{ example_en: "Example." }],
  };
}

function meaningPayload(meaning) {
  return {
    id: meaning.id,
    part_of_speech: meaning.part_of_speech,
    meaning_vi: meaning.meaning_vi,
    context: meaning.context,
    cefr_level: meaning.cefr_level,
    examples: meaning.examples.map((example) => ({
      id: example.id,
      example_en: example.example_en,
      example_vi: example.example_vi,
    })),
  };
}

function assertError(response, status, code) {
  assert.equal(response.status, status);
  assert.equal(response.json?.success, false);
  assert.equal(response.json?.error?.code, code);
  assert.equal(typeof response.json?.error?.message, "string");
}
