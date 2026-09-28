// @ts-nocheck
const VOCABULARY_SUMMARY_SELECT = {
  id: true,
  word: true,
  phonetic: true,
  pronunciation_url: true,
  created_at: true,
  updated_at: true,
};

const VOCABULARY_DETAIL_SELECT = {
  ...VOCABULARY_SUMMARY_SELECT,
  meanings: {
    orderBy: { created_at: "asc" },
    select: {
      id: true,
      part_of_speech: true,
      meaning_vi: true,
      context: true,
      cefr_level: true,
      created_at: true,
      updated_at: true,
      examples: {
        orderBy: { created_at: "asc" },
        select: {
          id: true,
          example_en: true,
          example_vi: true,
          created_at: true,
        },
      },
    },
  },
};

const PRIVATE_VOCABULARY_DETAIL_SELECT = {
  id: true,
  word: true,
  phonetic: true,
  meanings: VOCABULARY_DETAIL_SELECT.meanings,
};

export function createVocabularyRepository(prisma) {
  return {
    list() {
      return prisma.vOCABULARY.findMany({
        where: { owner_id: null },
        orderBy: { created_at: "asc" },
        select: VOCABULARY_SUMMARY_SELECT,
      });
    },

    findCompleteById(id) {
      return prisma.vOCABULARY.findUnique({
        where: { id, owner_id: null },
        select: VOCABULARY_DETAIL_SELECT,
      });
    },

    findCanonicalByWordInsensitive(word) {
      return prisma.vOCABULARY.findFirst({
        where: {
          owner_id: null,
          word: { equals: word, mode: "insensitive" },
        },
        select: { id: true },
      });
    },

    findOwnedPrivateById(ownerId, id) {
      return prisma.vOCABULARY.findUnique({
        where: { id, owner_id: ownerId },
        select: PRIVATE_VOCABULARY_DETAIL_SELECT,
      });
    },

    createAggregate(data) {
      return prisma.vOCABULARY.create({
        data: { ...data, owner_id: null },
        select: VOCABULARY_DETAIL_SELECT,
      });
    },

    updateVocabulary(id, data) {
      return prisma.vOCABULARY.update({
        where: { id, owner_id: null },
        data,
        select: { id: true },
      });
    },

    updateOwnedPrivateVocabulary(ownerId, id, data) {
      return prisma.vOCABULARY.update({
        where: { id, owner_id: ownerId },
        data,
        select: { id: true },
      });
    },

    createMeaning(vocabularyId, data) {
      return prisma.vOCABULARY_MEANING.create({
        data: { ...data, vocabulary_id: vocabularyId },
        select: { id: true },
      });
    },

    updateMeaning(id, data) {
      return prisma.vOCABULARY_MEANING.update({
        where: { id },
        data,
        select: { id: true },
      });
    },

    deleteMeanings(ids) {
      if (ids.length === 0) {
        return Promise.resolve({ count: 0 });
      }

      return prisma.vOCABULARY_MEANING.deleteMany({
        where: { id: { in: ids } },
      });
    },

    createExample(meaningId, data) {
      return prisma.vOCABULARY_EXAMPLE.create({
        data: { ...data, meaning_id: meaningId },
        select: { id: true },
      });
    },

    updateExample(id, data) {
      return prisma.vOCABULARY_EXAMPLE.update({
        where: { id },
        data,
        select: { id: true },
      });
    },

    deleteExamples(ids) {
      if (ids.length === 0) {
        return Promise.resolve({ count: 0 });
      }

      return prisma.vOCABULARY_EXAMPLE.deleteMany({
        where: { id: { in: ids } },
      });
    },

    deleteVocabulary(id) {
      return prisma.vOCABULARY.delete({
        where: { id, owner_id: null },
        select: { id: true },
      });
    },

    withTransaction(callback) {
      return prisma.$transaction(
        async (transaction) => callback(createVocabularyRepository(transaction)),
        { maxWait: 10_000, timeout: 30_000 },
      );
    },
  };
}
