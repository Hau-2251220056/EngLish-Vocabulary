// @ts-nocheck

export function createLoginAbuseRepository(prisma) {
  return {
    async lock(identifierKey, sourceKey) {
      // Serialize every source for one identifier so a successful login can
      // atomically clear all source-scoped failures without a cross-source race.
      await prisma.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${identifierKey}, 0))`;
    },

    async find(identifierKey, sourceKey) {
      const rows = await prisma.$queryRaw`
        SELECT "failure_count", "last_failed_at", "blocked_until", "updated_at"
        FROM "LOGIN_ABUSE_STATE"
        WHERE "identifier_key" = ${identifierKey}
          AND "source_key" = ${sourceKey}
        LIMIT 1
      `;
      return rows[0] ?? null;
    },

    async save({ identifierKey, sourceKey, failureCount, lastFailedAt, blockedUntil }) {
      await prisma.$executeRaw`
        INSERT INTO "LOGIN_ABUSE_STATE" (
          "identifier_key", "source_key", "failure_count", "last_failed_at",
          "blocked_until", "updated_at"
        ) VALUES (
          ${identifierKey}, ${sourceKey}, ${failureCount}, ${lastFailedAt},
          ${blockedUntil}, ${lastFailedAt}
        )
        ON CONFLICT ("identifier_key", "source_key") DO UPDATE SET
          "failure_count" = EXCLUDED."failure_count",
          "last_failed_at" = EXCLUDED."last_failed_at",
          "blocked_until" = EXCLUDED."blocked_until",
          "updated_at" = EXCLUDED."updated_at"
      `;
    },

    async deleteForIdentifier(identifierKey) {
      await prisma.$executeRaw`
        DELETE FROM "LOGIN_ABUSE_STATE"
        WHERE "identifier_key" = ${identifierKey}
      `;
    },

    async delete(identifierKey, sourceKey) {
      await prisma.$executeRaw`
        DELETE FROM "LOGIN_ABUSE_STATE"
        WHERE "identifier_key" = ${identifierKey}
          AND "source_key" = ${sourceKey}
      `;
    },
  };
}
