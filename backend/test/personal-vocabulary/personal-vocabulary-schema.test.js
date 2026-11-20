import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, afterEach, before, test } from "node:test";
import { createTestDatabase } from "../helpers/test-database.js";
import { BASELINE_FIXTURE } from "../scripts/seed-personal-vocabulary-baseline.js";

let database;
let prisma;

before(async () => {
  database = await createTestDatabase();
  prisma = database.prisma;
});

afterEach(async () => {
  await database.reset();
});

after(async () => {
  if (database) await database.disconnect();
});

test("PV-02 migration preserves baseline Vocabulary as canonical with Meaning and Example", async () => {
  const vocabulary = await prisma.vOCABULARY.findUniqueOrThrow({
    where: { id: BASELINE_FIXTURE.vocabularyId },
    include: { meanings: { include: { examples: true } } },
  });
  assert.equal(vocabulary.owner_id, null);
  assert.equal(vocabulary.word, BASELINE_FIXTURE.word);
  assert.equal(vocabulary.meanings.length, 1);
  assert.equal(vocabulary.meanings[0].id, BASELINE_FIXTURE.meaningId);
  assert.equal(vocabulary.meanings[0].examples[0].id, BASELINE_FIXTURE.exampleId);
});

test("PV-02 indexes enforce canonical uniqueness without private headword identity", async () => {
  const [ownerA, ownerB] = await Promise.all([createUser("owner-a"), createUser("owner-b")]);
  const canonical = await createVocabulary({ word: "book" });

  await assert.rejects(createVocabulary({ word: "BOOK" }));

  const privateRows = [];
  privateRows.push(await createVocabulary({ ownerId: ownerA.id, word: "book" }));
  privateRows.push(await createVocabulary({ ownerId: ownerA.id, word: "BOOK" }));
  privateRows.push(await createVocabulary({ ownerId: ownerB.id, word: "book" }));
  assert.equal(new Set([canonical.id, ...privateRows.map(({ id }) => id)]).size, 4);

  const indexes = await prisma.$queryRawUnsafe(
    `SELECT indexname, indexdef
       FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'VOCABULARY'
        AND indexname IN (
          'VOCABULARY_canonical_word_lower_key',
          'VOCABULARY_private_owner_word_lower_idx'
        )
      ORDER BY indexname`,
  );
  assert.equal(indexes.length, 2);
  const canonicalIndex = indexes.find(({ indexname }) =>
    indexname === "VOCABULARY_canonical_word_lower_key");
  const privateIndex = indexes.find(({ indexname }) =>
    indexname === "VOCABULARY_private_owner_word_lower_idx");
  assert.match(canonicalIndex.indexdef, /CREATE UNIQUE INDEX/i);
  assert.match(canonicalIndex.indexdef, /lower\(\(?word\)?::text\)/i);
  assert.match(canonicalIndex.indexdef, /owner_id IS NULL/i);
  assert.doesNotMatch(privateIndex.indexdef, /CREATE UNIQUE INDEX/i);
  assert.match(privateIndex.indexdef, /owner_id/i);
  assert.match(privateIndex.indexdef, /lower\(\(?word\)?::text\)/i);
  assert.match(privateIndex.indexdef, /owner_id IS NOT NULL/i);

  const ownerWordUniqueIndexes = await prisma.$queryRawUnsafe(
    `SELECT indexname
       FROM pg_indexes
      WHERE schemaname = current_schema()
        AND tablename = 'VOCABULARY'
        AND indexdef ILIKE 'CREATE UNIQUE INDEX%owner_id%word%'`,
  );
  assert.deepEqual(ownerWordUniqueIndexes, []);
});

test("PV-02 owner FK is enforced and owner deletion is RESTRICT", async () => {
  const owner = await createUser("restricted-owner");
  const vocabulary = await createVocabulary({ ownerId: owner.id, word: "owned" });
  await assert.rejects(createVocabulary({ ownerId: randomUUID(), word: "invalid-owner" }));
  await assert.rejects(prisma.uSER.delete({ where: { id: owner.id } }));
  assert.equal(await prisma.vOCABULARY.count({ where: { id: vocabulary.id } }), 1);

  const constraint = await constraintDefinition("VOCABULARY_owner_id_fkey");
  assert.match(constraint, /FOREIGN KEY \(owner_id\)/i);
  assert.match(constraint, /ON DELETE RESTRICT/i);
});

test("PV-02 operation record has narrow uniqueness, FK and deletion behavior", async () => {
  const owner = await createUser("operation-owner");
  const topic = await createTopic();
  const set = await createSet({ ownerId: owner.id, topicId: topic.id });
  const vocabulary = await createVocabulary({ ownerId: owner.id, word: "operation-word" });
  const operationId = randomUUID();

  await createOperation({ operationId, ownerId: owner.id, setId: set.id, vocabularyId: vocabulary.id });
  await assert.rejects(createOperation({
    operationId,
    ownerId: owner.id,
    setId: set.id,
    vocabularyId: vocabulary.id,
  }));
  await assert.rejects(createOperation({
    ownerId: randomUUID(), setId: set.id, vocabularyId: vocabulary.id,
  }));
  await assert.rejects(createOperation({
    ownerId: owner.id, setId: randomUUID(), vocabularyId: vocabulary.id,
  }));
  await assert.rejects(createOperation({
    ownerId: owner.id, setId: set.id, vocabularyId: randomUUID(),
  }));
  await assert.rejects(prisma.uSER.delete({ where: { id: owner.id } }));
  await assert.rejects(prisma.vOCABULARY.delete({ where: { id: vocabulary.id } }));

  await prisma.vOCABULARY_SET.delete({ where: { id: set.id } });
  assert.equal(
    await prisma.pRIVATE_VOCABULARY_CREATE_OPERATION.count({ where: { operation_id: operationId } }),
    0,
  );
  assert.equal(await prisma.vOCABULARY.count({ where: { id: vocabulary.id } }), 1);
});

test("PV-02 preserves exact-ID Set Item and Progress constraints", async () => {
  const owner = await createUser("exact-id-owner");
  const topic = await createTopic();
  const set = await createSet({ ownerId: owner.id, topicId: topic.id });
  const vocabulary = await createVocabulary({ word: `exact-${randomUUID()}` });

  await prisma.vOCABULARY_SET_ITEM.create({
    data: { vocabulary_set_id: set.id, vocabulary_id: vocabulary.id, position: 1 },
  });
  await assert.rejects(prisma.vOCABULARY_SET_ITEM.create({
    data: { vocabulary_set_id: set.id, vocabulary_id: vocabulary.id, position: 2 },
  }));

  await prisma.lEARNING_PROGRESS.create({
    data: { user_id: owner.id, vocabulary_id: vocabulary.id, status: "LEARNING" },
  });
  await assert.rejects(prisma.lEARNING_PROGRESS.create({
    data: { user_id: owner.id, vocabulary_id: vocabulary.id, status: "LEARNED" },
  }));

  assert.match(
    await indexDefinition("VOCABULARY_SET_ITEM_vocabulary_set_id_vocabulary_id_key"),
    /UNIQUE.*vocabulary_set_id.*vocabulary_id/i,
  );
  assert.match(
    await indexDefinition("LEARNING_PROGRESS_user_id_vocabulary_id_key"),
    /UNIQUE.*user_id.*vocabulary_id/i,
  );
});

function createUser(label) {
  return prisma.uSER.create({
    data: {
      email: `${label}-${randomUUID()}@example.test`,
      password_hash: "test-only-password-hash",
      display_name: label,
    },
  });
}

function createVocabulary({ ownerId = null, word }) {
  return prisma.vOCABULARY.create({ data: { owner_id: ownerId, word } });
}

function createTopic() {
  return prisma.tOPIC.create({
    data: { name: `PV-02 Topic ${randomUUID()}` },
  });
}

function createSet({ ownerId, topicId }) {
  return prisma.vOCABULARY_SET.create({
    data: {
      owner_id: ownerId,
      topic_id: topicId,
      name: `PV-02 Set ${randomUUID()}`,
      is_public: false,
    },
  });
}

function createOperation({
  operationId = randomUUID(), ownerId, setId, vocabularyId,
}) {
  return prisma.pRIVATE_VOCABULARY_CREATE_OPERATION.create({
    data: {
      operation_id: operationId,
      owner_id: ownerId,
      vocabulary_set_id: setId,
      vocabulary_id: vocabularyId,
      request_fingerprint: `server-derived-${randomUUID()}`,
    },
  });
}

async function constraintDefinition(name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT pg_get_constraintdef(oid) AS definition
       FROM pg_constraint
      WHERE conname = $1`,
    name,
  );
  assert.equal(rows.length, 1);
  return rows[0].definition;
}

async function indexDefinition(name) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT indexdef
       FROM pg_indexes
      WHERE schemaname = current_schema()
        AND indexname = $1`,
    name,
  );
  assert.equal(rows.length, 1);
  return rows[0].indexdef;
}
