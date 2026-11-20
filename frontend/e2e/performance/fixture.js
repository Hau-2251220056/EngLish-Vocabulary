import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PrismaClient } from "../../../backend/src/generated/prisma/client.ts";
import { hashPassword } from "../../../backend/src/utils/password-security.js";
import { configureTestEnvironment } from "../../../backend/test/helpers/test-environment.js";

export const PERFORMANCE_PASSWORD = "Performance-Test-Only-2026!";
export const FIXTURE_PATH = resolve(import.meta.dirname, "../../test-results/performance/fixture.json");

export async function createPerformanceFixture() {
  configureTestEnvironment({ requireReset: true });
  const prisma = new PrismaClient();
  await prisma.$connect();
  const runId = randomUUID();
  const prefix = `PERF-V1-${runId}`;
  const domain = `${runId}.performance.test`;
  const before = await protectedCounts(prisma);
  const passwordHash = await hashPassword(PERFORMANCE_PASSWORD);
  const [user, admin] = await Promise.all([
    prisma.uSER.create({ data: { email: `user@${domain}`, display_name: "Performance Learner", role: "USER", is_active: true, password_hash: passwordHash } }),
    prisma.uSER.create({ data: { email: `admin@${domain}`, display_name: "Performance Author", role: "ADMIN", is_active: true, password_hash: passwordHash } }),
  ]);
  const topic = await prisma.tOPIC.create({ data: { name: `${prefix} Travel`, description: "Bounded Performance V1 discovery fixture" } });
  const vocabulary = [];
  for (let index = 0; index < 6; index += 1) {
    vocabulary.push(await prisma.vOCABULARY.create({ data: {
      word: `${prefix} word-${index + 1}`,
      phonetic: `/perf-${index + 1}/`,
      meanings: { create: [{
        part_of_speech: "noun", meaning_vi: `Nghĩa kiểm thử ${index + 1}`,
        context: "Ngữ cảnh đo lường có giới hạn.", cefr_level: "A1",
        examples: { create: [{ example_en: `Performance example ${index + 1}.`, example_vi: `Ví dụ ${index + 1}.` }] },
      }] },
    } }));
  }
  const items = vocabulary.map(({ id: vocabulary_id }, index) => ({ vocabulary_id, position: index + 1 }));
  const [ownedSet, publicSet] = await Promise.all([
    prisma.vOCABULARY_SET.create({ data: { owner_id: user.id, name: `${prefix} Owned`, description: "Representative owned Set", is_public: false, items: { create: items } } }),
    prisma.vOCABULARY_SET.create({ data: { owner_id: admin.id, topic_id: topic.id, name: `${prefix} Public`, description: "Representative public Set", is_public: true, items: { create: items.slice(0, 4) } } }),
  ]);
  await prisma.lEARNING_PROGRESS.create({ data: {
    user_id: user.id, vocabulary_id: vocabulary[5].id, status: "LEARNED", review_count: 1,
    revision: 1, interval_days: 3, last_reviewed_at: new Date(), next_review_at: new Date(Date.now() + 3 * 86_400_000),
  } });
  const fixture = {
    run_id: runId, prefix, domain, before,
    user: { id: user.id, email: user.email }, admin_id: admin.id, topic_id: topic.id,
    owned_set_id: ownedSet.id, owned_set_name: ownedSet.name,
    public_set_id: publicSet.id, public_set_name: publicSet.name,
    vocabulary_ids: vocabulary.map(({ id }) => id),
  };
  await mkdir(resolve(FIXTURE_PATH, ".."), { recursive: true });
  await writeFile(FIXTURE_PATH, `${JSON.stringify(fixture, null, 2)}\n`, "utf8");
  await prisma.$disconnect();
  return fixture;
}

export async function cleanupPerformanceFixture() {
  configureTestEnvironment({ requireReset: true });
  const fixture = JSON.parse(await readFile(FIXTURE_PATH, "utf8"));
  const prisma = new PrismaClient();
  await prisma.$connect();
  try {
    const userIds = [fixture.user.id, fixture.admin_id];
    await prisma.lEARNING_PROGRESS.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.aUTH_SESSION.deleteMany({ where: { user_id: { in: userIds } } });
    await prisma.vOCABULARY_SET.deleteMany({ where: { id: { in: [fixture.owned_set_id, fixture.public_set_id] } } });
    await prisma.vOCABULARY.deleteMany({ where: { id: { in: fixture.vocabulary_ids } } });
    await prisma.tOPIC.deleteMany({ where: { id: fixture.topic_id } });
    await prisma.uSER.deleteMany({ where: { id: { in: userIds } } });
    const after = await protectedCounts(prisma);
    const evidence = { before: fixture.before, after, unchanged: fixture.before.users === after.users && fixture.before.sessions === after.sessions };
    await writeFile(resolve(FIXTURE_PATH, "../cleanup.json"), `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
    if (!evidence.unchanged) throw new Error("Performance cleanup did not preserve unrelated TEST users/sessions.");
  } finally {
    await prisma.$disconnect();
  }
}

async function protectedCounts(prisma) {
  const [users, sessions] = await Promise.all([prisma.uSER.count(), prisma.aUTH_SESSION.count()]);
  return { users, sessions };
}
