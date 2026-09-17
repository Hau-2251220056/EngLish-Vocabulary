// @ts-nocheck
const AUTH_SESSION_SELECT = {
  id: true,
  user_id: true,
  session_identifier_hash: true,
  created_at: true,
  expires_at: true,
};

export function createAuthSessionRepository(prisma) {
  return {
    createSession({ user_id, session_identifier_hash, expires_at }) {
      return prisma.aUTH_SESSION.create({
        data: { user_id, session_identifier_hash, expires_at },
        select: AUTH_SESSION_SELECT,
      });
    },

    findBySessionIdentifierHash(session_identifier_hash) {
      return prisma.aUTH_SESSION.findUnique({
        where: { session_identifier_hash },
        select: AUTH_SESSION_SELECT,
      });
    },

    deleteBySessionIdentifierHash(session_identifier_hash) {
      return prisma.aUTH_SESSION.delete({
        where: { session_identifier_hash },
        select: AUTH_SESSION_SELECT,
      });
    },
  };
}
