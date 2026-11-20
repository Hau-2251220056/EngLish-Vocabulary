// @ts-nocheck
const TOPIC_SELECT = {
  id: true,
  name: true,
  description: true,
  created_at: true,
  updated_at: true,
};

export function createTopicRepository(prisma) {
  return {
    list() {
      return prisma.tOPIC.findMany({ select: TOPIC_SELECT });
    },

    findById(id) {
      return prisma.tOPIC.findUnique({
        where: { id },
        select: TOPIC_SELECT,
      });
    },

    findByNameInsensitive(name) {
      return prisma.tOPIC.findFirst({
        where: { name: { equals: name, mode: "insensitive" } },
        select: { id: true },
      });
    },

    create({ name, description }) {
      return prisma.tOPIC.create({
        data: { name, description },
        select: TOPIC_SELECT,
      });
    },

    update(id, data) {
      return prisma.tOPIC.update({
        where: { id },
        data,
        select: TOPIC_SELECT,
      });
    },

    delete(id) {
      return prisma.tOPIC.delete({
        where: { id },
        select: { id: true },
      });
    },
  };
}
