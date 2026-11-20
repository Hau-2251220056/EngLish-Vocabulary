// @ts-nocheck

export function createStreakRepository(transaction) {
  requireTransactionClient(transaction);

  return Object.freeze({
    async insertDayForCompletedSession({ session, activityDate, createdAt }) {
      assertCompletedSession(session);
      assertIsoDate(activityDate);
      const insertionInstant = cloneInstant(createdAt, "createdAt");

      const inserted = await transaction.$executeRaw`
        INSERT INTO "STREAK_DAY" (
          "id",
          "user_id",
          "activity_date",
          "first_session_id",
          "created_at"
        )
        VALUES (
          gen_random_uuid(),
          ${session.user_id}::uuid,
          ${activityDate}::date,
          ${session.id}::uuid,
          ${insertionInstant}::timestamp(3)
        )
        ON CONFLICT ("user_id", "activity_date") DO NOTHING
      `;

      return Object.freeze({ inserted: inserted === 1 });
    },

    async listActivityDatesThrough(userId, throughDate) {
      assertIsoDate(throughDate);
      const rows = await transaction.sTREAK_DAY.findMany({
        where: {
          user_id: userId,
          activity_date: { lte: new Date(`${throughDate}T00:00:00.000Z`) },
        },
        orderBy: { activity_date: "desc" },
        select: { activity_date: true },
      });
      return rows.map(({ activity_date: date }) => date.toISOString().slice(0, 10));
    },
  });
}

function assertCompletedSession(session) {
  if (
    !session
    || session.status !== "COMPLETED"
    || typeof session.id !== "string"
    || typeof session.user_id !== "string"
  ) {
    throw new TypeError("A validated completed session is required.");
  }
}

function assertIsoDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new TypeError("activityDate must be an ISO YYYY-MM-DD string.");
  }
  const canonical = new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10);
  if (canonical !== value) {
    throw new TypeError("activityDate must be a valid ISO calendar date.");
  }
}

function cloneInstant(value, name) {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    throw new TypeError(`${name} must be a valid Date.`);
  }
  return new Date(value.getTime());
}

function requireTransactionClient(transaction) {
  if (
    !transaction
    || typeof transaction !== "object"
    || !transaction.sTREAK_DAY
    || typeof transaction.$executeRaw !== "function"
  ) {
    throw new TypeError("A caller-provided Prisma transaction client is required.");
  }
}
