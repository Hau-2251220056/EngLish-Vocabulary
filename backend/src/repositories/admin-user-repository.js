// @ts-nocheck
const ADMIN_USER_LIST_SELECT = {
  id: true,
  display_name: true,
  email: true,
  avatar_url: true,
  role: true,
  is_active: true,
  created_at: true,
};

const ADMIN_USER_DETAIL_SELECT = {
  ...ADMIN_USER_LIST_SELECT,
  updated_at: true,
};

export function createAdminUserRepository(prisma) {
  return {
    async list({ page, page_size, query, role }) {
      const where = buildWhere({ query, role });
      const [total, items] = await prisma.$transaction([
        prisma.uSER.count({ where }),
        prisma.uSER.findMany({
          where,
          select: ADMIN_USER_LIST_SELECT,
          orderBy: [{ created_at: "desc" }, { id: "desc" }],
          skip: (page - 1) * page_size,
          take: page_size,
        }),
      ]);

      return { items, total };
    },

    async listStreakActivityDates(userIds, throughDate) {
      if (userIds.length === 0) return [];
      const rows = await prisma.sTREAK_DAY.findMany({
        where: {
          user_id: { in: userIds },
          activity_date: { lte: new Date(`${throughDate}T00:00:00.000Z`) },
        },
        orderBy: [{ user_id: "asc" }, { activity_date: "desc" }],
        select: { user_id: true, activity_date: true },
      });
      return rows.map(({ user_id, activity_date }) => ({
        user_id,
        activity_date: activity_date.toISOString().slice(0, 10),
      }));
    },

    findById(userId) {
      return prisma.uSER.findUnique({
        where: { id: userId },
        select: ADMIN_USER_DETAIL_SELECT,
      });
    },
  };
}

function buildWhere({ query, role }) {
  return {
    ...(role ? { role } : {}),
    ...(query
      ? {
          OR: [
            { display_name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}
