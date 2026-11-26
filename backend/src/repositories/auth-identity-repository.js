// @ts-nocheck
const IDENTITY_USER_SELECT = {
  id: true,
  email: true,
  password_hash: true,
  display_name: true,
  role: true,
  is_active: true,
};

export function createAuthIdentityRepository(prisma) {
  return {
    findGoogleIdentity(provider_subject) {
      return prisma.aUTH_IDENTITY.findUnique({
        where: { provider_provider_subject: { provider: "GOOGLE", provider_subject } },
        select: {
          id: true,
          provider_email: true,
          user: { select: IDENTITY_USER_SELECT },
        },
      });
    },

    createGoogleIdentity({ user_id, provider_subject, provider_email }) {
      return prisma.aUTH_IDENTITY.create({
        data: { user_id, provider: "GOOGLE", provider_subject, provider_email },
        select: { id: true, user_id: true, provider_subject: true, provider_email: true },
      });
    },

    updateGoogleEmail(id, provider_email) {
      return prisma.aUTH_IDENTITY.update({
        where: { id },
        data: { provider_email },
        select: { id: true },
      });
    },
  };
}
