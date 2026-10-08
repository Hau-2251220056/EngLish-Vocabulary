// @ts-nocheck
const SET_SUMMARY_SELECT = {
  id: true,
  topic_id: true,
  name: true,
  description: true,
  cefr_level: true,
  cover_image_url: true,
  cover_storage_key: true,
  is_public: true,
  created_at: true,
  updated_at: true,
  _count: { select: { items: true } },
};

const SET_DETAIL_SELECT = {
  id: true,
  topic_id: true,
  name: true,
  description: true,
  cefr_level: true,
  cover_image_url: true,
  cover_storage_key: true,
  is_public: true,
  created_at: true,
  updated_at: true,
  items: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      vocabulary_id: true,
      position: true,
      created_at: true,
      vocabulary: { select: { word: true, phonetic: true, owner_id: true } },
    },
  },
};

const PRIVATE_SET_DETAIL_SELECT = {
  ...SET_DETAIL_SELECT,
  items: {
    orderBy: { position: "asc" },
    select: {
      id: true,
      vocabulary_id: true,
      position: true,
      created_at: true,
      vocabulary: {
        select: {
          word: true,
          phonetic: true,
          owner_id: true,
          meanings: {
            orderBy: [{ created_at: "asc" }, { id: "asc" }],
            take: 1,
            select: {
              part_of_speech: true,
              meaning_vi: true,
              examples: {
                orderBy: [{ created_at: "asc" }, { id: "asc" }],
                take: 1,
                select: { example_en: true, example_vi: true },
              },
            },
          },
        },
      },
    },
  },
};

const PRIVATE_CREATED_VOCABULARY_SELECT = {
  id: true,
  word: true,
  phonetic: true,
  meanings: {
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: {
      id: true,
      part_of_speech: true,
      meaning_vi: true,
      context: true,
      cefr_level: true,
      examples: {
        orderBy: [{ created_at: "asc" }, { id: "asc" }],
        select: { id: true, example_en: true, example_vi: true },
      },
    },
  },
};

export function createVocabularySetRepository(prisma) {
  return {
    listPublicByTopic(topicId) {
      return prisma.vOCABULARY_SET.findMany({
        where: { topic_id: topicId, is_public: true },
        orderBy: { created_at: "asc" },
        select: SET_SUMMARY_SELECT,
      });
    },

    listSystem() {
      return prisma.vOCABULARY_SET.findMany({
        where: { is_public: true },
        orderBy: { created_at: "asc" },
        select: SET_SUMMARY_SELECT,
      });
    },

    listPrivateByOwner(ownerId) {
      return prisma.vOCABULARY_SET.findMany({
        where: { owner_id: ownerId, is_public: false },
        orderBy: { created_at: "asc" },
        select: SET_SUMMARY_SELECT,
      });
    },

    findPublicSystemById(id) {
      return prisma.vOCABULARY_SET.findFirst({
        where: { id, is_public: true },
        select: SET_DETAIL_SELECT,
      });
    },

    findPrivateByIdForOwner(id, ownerId) {
      return prisma.vOCABULARY_SET.findFirst({
        where: { id, owner_id: ownerId, is_public: false },
        select: PRIVATE_SET_DETAIL_SELECT,
      });
    },

    findTopicById(id) {
      return prisma.tOPIC.findUnique({ where: { id }, select: { id: true } });
    },

    findCanonicalVocabularyIds(ids) {
      return prisma.vOCABULARY.findMany({
        where: { id: { in: ids }, owner_id: null },
        select: { id: true },
      });
    },

    findReusableVocabularyIdsForOwner(ownerId, ids) {
      return prisma.vOCABULARY.findMany({
        where: {
          id: { in: ids },
          OR: [{ owner_id: null }, { owner_id: ownerId }],
        },
        select: { id: true },
      });
    },

    searchVocabularyPicker(query, limit, { ownerId, canonicalOnly }) {
      return prisma.vOCABULARY.findMany({
        where: {
          word: { contains: query, mode: "insensitive" },
          ...(canonicalOnly
            ? { owner_id: null }
            : { OR: [{ owner_id: null }, { owner_id: ownerId }] }),
        },
        orderBy: [{ word: "asc" }, { id: "asc" }],
        take: limit,
        select: {
          id: true,
          owner_id: true,
          word: true,
          phonetic: true,
          meanings: {
            orderBy: [{ created_at: "asc" }, { id: "asc" }],
            take: 1,
            select: { part_of_speech: true, meaning_vi: true },
          },
        },
      });
    },

    async lockPrivateSetForOwner(id, ownerId) {
      const rows = await prisma.$queryRaw`
        SELECT "id"
        FROM "VOCABULARY_SET"
        WHERE "id" = ${id}::uuid
          AND "owner_id" = ${ownerId}::uuid
          AND "is_public" = FALSE
        FOR UPDATE
      `;
      return rows[0] ?? null;
    },

    createPrivateVocabularyAggregate(ownerId, vocabulary) {
      return prisma.vOCABULARY.create({
        data: {
          owner_id: ownerId,
          word: vocabulary.word,
          phonetic: vocabulary.phonetic,
          pronunciation_url: null,
          meanings: {
            create: vocabulary.meanings.map((meaning) => ({
              part_of_speech: meaning.part_of_speech,
              meaning_vi: meaning.meaning_vi,
              context: meaning.context,
              cefr_level: meaning.cefr_level,
              examples: { create: meaning.examples },
            })),
          },
        },
        select: PRIVATE_CREATED_VOCABULARY_SELECT,
      });
    },

    async appendVocabularyToLockedSet(vocabularySetId, vocabularyId) {
      const maximum = await prisma.vOCABULARY_SET_ITEM.aggregate({
        where: { vocabulary_set_id: vocabularySetId },
        _max: { position: true },
      });
      return prisma.vOCABULARY_SET_ITEM.create({
        data: {
          vocabulary_set_id: vocabularySetId,
          vocabulary_id: vocabularyId,
          position: (maximum._max.position ?? 0) + 1,
        },
        select: { id: true, vocabulary_id: true, position: true, created_at: true },
      });
    },

    createPrivateCreateOperation(data) {
      return prisma.pRIVATE_VOCABULARY_CREATE_OPERATION.create({
        data,
        select: { operation_id: true },
      });
    },

    async findPrivateCreateResult(operationId) {
      const operation = await prisma.pRIVATE_VOCABULARY_CREATE_OPERATION.findUnique({
        where: { operation_id: operationId },
        select: {
          operation_id: true,
          owner_id: true,
          vocabulary_set_id: true,
          vocabulary_id: true,
          request_fingerprint: true,
          vocabulary: { select: PRIVATE_CREATED_VOCABULARY_SELECT },
        },
      });
      if (!operation) return null;
      const membership = await prisma.vOCABULARY_SET_ITEM.findUnique({
        where: {
          vocabulary_set_id_vocabulary_id: {
            vocabulary_set_id: operation.vocabulary_set_id,
            vocabulary_id: operation.vocabulary_id,
          },
        },
        select: { id: true, vocabulary_id: true, position: true, created_at: true },
      });
      return { ...operation, membership };
    },

    createSystem(data) {
      return prisma.vOCABULARY_SET.create({
        data,
        select: SET_DETAIL_SELECT,
      });
    },

    createPrivate(data) {
      return prisma.vOCABULARY_SET.create({
        data,
        select: PRIVATE_SET_DETAIL_SELECT,
      });
    },

    updateSystem(id, data) {
      return prisma.vOCABULARY_SET.update({
        where: { id },
        data,
        select: { id: true },
      });
    },

    updateCoverMetadata(id, { cover_image_url, cover_storage_key }) {
      return prisma.vOCABULARY_SET.update({
        where: { id },
        data: { cover_image_url, cover_storage_key },
        select: { id: true },
      });
    },

    async replaceItems(vocabularySetId, vocabularyIds) {
      await prisma.vOCABULARY_SET_ITEM.deleteMany({
        where: { vocabulary_set_id: vocabularySetId },
      });
      if (vocabularyIds.length === 0) return { count: 0 };
      return prisma.vOCABULARY_SET_ITEM.createMany({
        data: vocabularyIds.map((vocabularyId, index) => ({
          vocabulary_set_id: vocabularySetId,
          vocabulary_id: vocabularyId,
          position: index + 1,
        })),
      });
    },

    deleteSystem(id) {
      return prisma.vOCABULARY_SET.delete({
        where: { id },
        select: { id: true },
      });
    },

    withTransaction(callback) {
      return prisma.$transaction(
        async (transaction) => callback(createVocabularySetRepository(transaction)),
        { maxWait: 10_000, timeout: 30_000 },
      );
    },
  };
}
