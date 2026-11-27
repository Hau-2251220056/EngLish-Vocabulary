import { Prisma } from "../generated/prisma/client.ts";

export function createLearnerNotificationRepository(prisma) {
  const inbox = prisma.lEARNER_NOTIFICATION;
  function eligible(userId, since) {
    return { user_id: userId, occurred_at: { gte: since } };
  }

  return {
    async sources(userId, startDay, today, now) {
      const [source] = await prisma.$queryRaw`
        SELECT COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object('day', "activity_date"::text, 'qualified_at', "created_at" AT TIME ZONE 'UTC')
            ORDER BY "activity_date"
          ) FROM "STREAK_DAY"
          WHERE "user_id" = ${userId}::uuid
            AND "activity_date" BETWEEN ${startDay}::date AND ${today}::date
        ), '[]'::jsonb) AS days, ARRAY(
          SELECT "created_at" FROM (
            SELECT "created_at", row_number() OVER (ORDER BY "created_at", "id") AS n
            FROM (
              SELECT "created_at", "id" FROM "LEARNING_PROGRESS"
              WHERE "user_id" = ${userId}::uuid AND "created_at" <= ${now}::timestamp
              ORDER BY "created_at", "id"
              LIMIT 1000
            ) AS first_started
          ) AS progress
          WHERE n IN (25, 50, 100, 250, 500, 1000)
          ORDER BY n
        ) AS "progressDates"`;
      return source;
    },

    insert(userId, events) {
      if (!events.length) return;
      return inbox.createMany({ data: events.map((event) => ({ ...event, user_id: userId })), skipDuplicates: true });
    },

    async page(userId, since, cursor, limit) {
      const continuation = cursor
        ? Prisma.sql`AND ("occurred_at", "id") < (${cursor.at}::timestamptz, ${cursor.id}::uuid)`
        : Prisma.empty;
      const [page] = await prisma.$queryRaw`
        SELECT (
          SELECT COUNT(*)::int FROM "LEARNER_NOTIFICATION"
          WHERE "user_id" = ${userId}::uuid AND "occurred_at" >= ${since}::timestamptz
            AND "read_at" IS NULL
        ) AS unread_count, COALESCE((
          SELECT jsonb_agg(to_jsonb(page) ORDER BY page.occurred_at DESC, page.id DESC)
          FROM (
            SELECT "id", "type", "occurred_at", "read_at", "payload"
            FROM "LEARNER_NOTIFICATION"
            WHERE "user_id" = ${userId}::uuid AND "occurred_at" >= ${since}::timestamptz
              ${continuation}
            ORDER BY "occurred_at" DESC, "id" DESC LIMIT ${limit}
          ) AS page
        ), '[]'::jsonb) AS items`;
      return page;
    },

    async markOne(userId, id, since, now) {
      const where = { ...eligible(userId, since), id };
      await inbox.updateMany({ where: { ...where, read_at: null }, data: { read_at: now } });
      return inbox.findFirst({ where, select: { id: true, read_at: true } });
    },

    markAll(userId, since, now) {
      return inbox.updateMany({ where: { ...eligible(userId, since), read_at: null }, data: { read_at: now } });
    },

    unreadCount(userId, since) {
      return inbox.count({ where: { ...eligible(userId, since), read_at: null } });
    },

    transact(callback) {
      return prisma.$transaction((tx) => callback(createLearnerNotificationRepository(tx)), {
        maxWait: 2000, timeout: 5000,
      });
    },
  };
}
