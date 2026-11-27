// @ts-nocheck
export function createGoogleAuthChallengeRepository(prisma) {
  return {
    async create({ nonce_hash, browser_binding_hash, source_key, expires_at, now }) {
      await prisma.gOOGLE_AUTH_CHALLENGE.deleteMany({
        where: { expires_at: { lte: now } },
      });
      return prisma.gOOGLE_AUTH_CHALLENGE.create({
        data: { nonce_hash, browser_binding_hash, source_key, expires_at, issued_at: now },
        select: { expires_at: true },
      });
    },

    countRecentForSource(source_key, since) {
      return prisma.gOOGLE_AUTH_CHALLENGE.count({
        where: { source_key, issued_at: { gt: since } },
      });
    },

    consume({ nonce_hash, browser_binding_hash, consumed_at }) {
      return prisma.gOOGLE_AUTH_CHALLENGE.updateMany({
        where: {
          nonce_hash,
          browser_binding_hash,
          consumed_at: null,
          expires_at: { gt: consumed_at },
        },
        data: { consumed_at },
      });
    },
  };
}
