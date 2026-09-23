// @ts-nocheck
const SET_SUMMARY_SELECT = {
  id: true,
  topic_id: true,
  name: true,
  description: true,
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
      vocabulary: { select: { word: true, phonetic: true } },
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
        select: SET_DETAIL_SELECT,
      });
    },

    findTopicById(id) {
      return prisma.tOPIC.findUnique({ where: { id }, select: { id: true } });
    },

    findVocabularyIds(ids) {
      return prisma.vOCABULARY.findMany({
        where: { id: { in: ids } },
        select: { id: true },
      });
    },

    searchVocabularyPicker(query, limit) {
      return prisma.vOCABULARY.findMany({
        where: { word: { contains: query, mode: "insensitive" } },
        orderBy: { word: "asc" },
        take: limit,
        select: { id: true, word: true, phonetic: true },
      });
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
        select: SET_DETAIL_SELECT,
      });
    },

    updateSystem(id, data) {
      return prisma.vOCABULARY_SET.update({
        where: { id },
        data,
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
