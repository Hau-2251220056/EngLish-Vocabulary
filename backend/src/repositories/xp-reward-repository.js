// @ts-nocheck

export const XP_REWARD_COLLISION_KINDS = Object.freeze({
  REWARD_IDENTITY: "REWARD_IDENTITY",
  SOURCE_EVENT: "SOURCE_EVENT",
});

export class XpRewardCollisionError extends Error {
  constructor(kind, cause) {
    super("XP reward already exists.", { cause });
    this.name = "XpRewardCollisionError";
    this.code = "XP_REWARD_COLLISION";
    this.kind = kind;
  }
}

export function isXpRewardCollisionError(error) {
  return error instanceof XpRewardCollisionError;
}

export function createXpRewardRepository(prisma) {
  const repository = {
    findRewardBySourceEvent(userId, sourceEventId) {
      return prisma.xP_REWARD.findUnique({
        where: {
          user_id_source_event_id: {
            user_id: userId,
            source_event_id: sourceEventId,
          },
        },
        select: rewardSelect(),
      });
    },

    findRewardByIdentity(userId, vocabularyId, rewardType, rewardCycle) {
      return prisma.xP_REWARD.findUnique({
        where: {
          user_id_vocabulary_id_reward_type_reward_cycle: {
            user_id: userId,
            vocabulary_id: vocabularyId,
            reward_type: rewardType,
            reward_cycle: rewardCycle,
          },
        },
        select: rewardSelect(),
      });
    },

    async insertPositiveReward(data) {
      try {
        return await prisma.xP_REWARD.create({
          data: {
            user_id: data.user_id,
            vocabulary_id: data.vocabulary_id,
            reward_type: data.reward_type,
            reward_cycle: data.reward_cycle,
            source_event_id: data.source_event_id,
            xp_amount: data.xp_amount,
          },
          select: rewardSelect(),
        });
      } catch (error) {
        const collisionKind = classifyRewardCollision(error);
        if (!collisionKind) throw error;
        throw new XpRewardCollisionError(collisionKind, error);
      }
    },

    async readUserTotalXp(userId) {
      const user = await prisma.uSER.findUnique({
        where: { id: userId },
        select: { total_xp: true },
      });
      return user?.total_xp ?? null;
    },

    async incrementUserTotalXp(userId, amount) {
      const user = await prisma.uSER.update({
        where: { id: userId },
        data: { total_xp: { increment: amount } },
        select: { total_xp: true },
      });
      return user.total_xp;
    },

    async insertRewardAndIncrementXp(data) {
      const reward = await repository.insertPositiveReward(data);
      const totalXp = await repository.incrementUserTotalXp(data.user_id, reward.xp_amount);
      return { reward, total_xp: totalXp };
    },
  };

  return repository;
}

function rewardSelect() {
  return {
    user_id: true,
    vocabulary_id: true,
    reward_type: true,
    reward_cycle: true,
    source_event_id: true,
    xp_amount: true,
  };
}

function classifyRewardCollision(error) {
  if (error?.code !== "P2002") return null;

  const target = Array.isArray(error.meta?.target)
    ? error.meta.target.join(",")
    : String(error.meta?.target ?? "");

  if (target.includes("source_event_id")) {
    return XP_REWARD_COLLISION_KINDS.SOURCE_EVENT;
  }
  if (
    target.includes("vocabulary_id")
    && target.includes("reward_type")
    && target.includes("reward_cycle")
  ) {
    return XP_REWARD_COLLISION_KINDS.REWARD_IDENTITY;
  }
  return null;
}
