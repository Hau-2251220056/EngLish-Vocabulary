// @ts-nocheck
const AUTHENTICATION_USER_SELECT = {
  id: true,
  email: true,
  password_hash: true,
  display_name: true,
  role: true,
  is_active: true,
};

export function createUserRepository(prisma) {
  return {
    findByNormalizedEmail(email) {
      return prisma.uSER.findUnique({
        where: { email },
        select: AUTHENTICATION_USER_SELECT,
      });
    },

    findById(id) {
      return prisma.uSER.findUnique({
        where: { id },
        select: AUTHENTICATION_USER_SELECT,
      });
    },

    createUser({ email, password_hash, display_name }) {
      return prisma.uSER.create({
        data: { email, password_hash, display_name },
        select: AUTHENTICATION_USER_SELECT,
      });
    },
  };
}
