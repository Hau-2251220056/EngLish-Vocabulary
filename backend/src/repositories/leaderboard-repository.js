export function createLeaderboardRepository(prisma) {
  return {
    async readSnapshot({ userId, period, start, end, asOf, applicationDate, first, last }) {
      // XP_REWARD.created_at is timestamp without time zone. The UTC writer
      // convention must be verified in TEST before the bounded periods ship.
      const allTime = period === "all";

      return prisma.$transaction(async (transaction) => {
        await transaction.$executeRaw`SET TRANSACTION READ ONLY`;
        await transaction.$executeRaw`SET LOCAL statement_timeout = '5s'`;

        const rows = await transaction.$queryRaw`
          WITH eligible AS (
            SELECT id, total_xp FROM "USER" WHERE role = 'USER' AND is_active
          ), scores AS (
            SELECT id, total_xp::bigint AS xp FROM eligible
            WHERE ${allTime}::boolean AND total_xp > 0
            UNION ALL
            SELECT learner.id, SUM(reward.xp_amount)::bigint AS xp
            FROM "XP_REWARD" reward
            JOIN eligible learner ON learner.id = reward.user_id
            WHERE NOT ${allTime}::boolean
              AND reward.created_at >= ${utcTimestamp(start)}::timestamp
              AND reward.created_at < ${utcTimestamp(end)}::timestamp
              AND reward.created_at <= ${utcTimestamp(asOf)}::timestamp
            GROUP BY learner.id
            HAVING SUM(reward.xp_amount) > 0
          ), ranked AS (
            SELECT id, xp, RANK() OVER (ORDER BY xp DESC) AS rank,
                   ROW_NUMBER() OVER (ORDER BY xp DESC, id ASC) AS position
            FROM scores
          ), picked AS (
            SELECT id, xp, rank, position FROM ranked
            WHERE position <= 3 OR position BETWEEN ${first}::bigint AND ${last}::bigint
              OR id = ${userId}::uuid
            UNION ALL
            SELECT id, 0::bigint, NULL::bigint, NULL::bigint
            FROM eligible
            WHERE id = ${userId}::uuid AND NOT EXISTS (
              SELECT 1 FROM ranked WHERE id = ${userId}::uuid
            )
          )
          SELECT picked.*, learner.display_name, learner.email,
                 (SELECT COUNT(*) FROM ranked) AS total
          FROM picked
          JOIN "USER" learner USING (id)
          ORDER BY position NULLS LAST`;

        if (!rows.some((row) => row.id === userId)) return { rows: [], activityDays: [] };
        const activityDays = await transaction.sTREAK_DAY.findMany({
          where: {
            user_id: { in: rows.map(({ id }) => id) },
            activity_date: { lte: new Date(`${applicationDate}T00:00:00.000Z`) },
          },
          select: { user_id: true, activity_date: true },
        });
        return { rows, activityDays };
      }, { isolationLevel: "RepeatableRead", maxWait: 3_000, timeout: 12_000 });
    },
  };
}

function utcTimestamp(value) {
  return value?.slice(0, -1) ?? null;
}
