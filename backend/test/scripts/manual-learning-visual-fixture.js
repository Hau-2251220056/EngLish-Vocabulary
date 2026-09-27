import process from "node:process";
import { configureTestEnvironment } from "../helpers/test-environment.js";
import { hashPassword } from "../../src/utils/password-security.js";

const [mode, runId] = process.argv.slice(2);
const RUN_ID_PATTERN = /^[a-z0-9-]{8,64}$/i;
const PASSWORD = "VisualReview-Only-2026!";

if (!new Set(["create", "verify", "cleanup"]).has(mode) || !RUN_ID_PATTERN.test(runId ?? "")) {
  console.error(
    "Usage: node --env-file=.env.test test/scripts/manual-learning-visual-fixture.js <create|verify|cleanup> <run-id>",
  );
  process.exitCode = 1;
} else {
  await run();
}

async function run() {
  configureTestEnvironment({ requireReset: true });
  const { PrismaClient } = await import("../../src/generated/prisma/client.ts");
  const prisma = new PrismaClient();

  try {
    await prisma.$connect();
    if (mode === "create") {
      await createFixture(prisma);
    } else if (mode === "verify") {
      await verifyFixture(prisma);
    } else {
      await cleanupFixture(prisma);
    }
  } catch (error) {
    console.error(`Manual Learning fixture ${mode} failed: ${safeError(error)}`);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

async function verifyFixture(prisma) {
  const fixture = fixtureIdentity(runId);
  const user = await prisma.uSER.findUnique({ where: { email: fixture.email } });
  const set = await prisma.vOCABULARY_SET.findFirst({
    where: {
      name: { startsWith: fixture.prefix },
      owner_id: user?.id,
      is_public: false,
    },
    include: {
      items: {
        orderBy: { position: "asc" },
        include: {
          vocabulary: {
            include: {
              meanings: {
                orderBy: [{ created_at: "asc" }, { id: "asc" }],
                include: { examples: true },
              },
            },
          },
        },
      },
    },
  });

  const positions = set?.items.map(({ position }) => position) ?? [];
  const words = set?.items.map(({ vocabulary }) => vocabulary.word) ?? [];
  const journey = set?.items.find(({ vocabulary }) => vocabulary.word === "travel");
  const journeyLevels = journey?.vocabulary.meanings.map(({ cefr_level }) => cefr_level) ?? [];
  const progress = user
    ? await prisma.lEARNING_PROGRESS.findMany({
        where: { user_id: user.id },
        include: { vocabulary: { select: { word: true } } },
        orderBy: { status: "asc" },
      })
    : [];
  const progressStatuses = progress.map(({ status }) => status).sort();
  const valid = Boolean(
    user
      && set
      && positions.join(",") === "1,2,3,4,5,6,7,8"
      && words.join(",") === "book,travel,committee,resilient,mother-in-law,a,ooo,extraordinarily long vocabulary phrase"
      && set.items.every(({ vocabulary }) => (
        vocabulary.meanings.length > 0
        && vocabulary.meanings.some(({ examples }) => examples.length > 0)
      ))
      && journeyLevels.includes("A1")
      && journeyLevels.includes("B2")
      && progress.length === 3
      && progressStatuses.join(",") === "LEARNED,LEARNING,NEEDS_REVIEW"
      && progress.every(({ review_count: reviewCount }) => reviewCount > 0),
  );

  if (!valid) {
    throw new Error("controlled fixture is missing or incomplete");
  }

  console.log("Manual Learning visual fixture verified in the guarded TEST database.");
  console.log(`Controlled records: 1 user, 1 private set, ${words.length} ordered vocabulary cards.`);
  console.log("Learning Progress View exercise: LEARNING, LEARNED and NEEDS_REVIEW are all present.");
  console.log("Primary-Meaning exercise: multi-Meaning card contains A1 and B2 meanings in deterministic storage order.");
  console.log(`Learning path: /learn/vocabulary-sets/${set.id}`);
  console.log("Progress path: /my/learning-progress");
}

async function createFixture(prisma) {
  const fixture = fixtureIdentity(runId);
  const existing = await findControlledData(prisma, fixture);
  if (existing.total > 0) {
    throw new Error("controlled fixture already exists; run targeted cleanup first");
  }

  const passwordHash = await hashPassword(PASSWORD);
  const result = await prisma.$transaction(async (transaction) => {
    const user = await transaction.uSER.create({
      data: {
        email: fixture.email,
        password_hash: passwordHash,
        display_name: "Flashcard Visual Reviewer",
        role: "USER",
        is_active: true,
      },
    });
    const topic = await transaction.tOPIC.create({
      data: {
        name: `${fixture.prefix} Travel & Study`,
        description: "Controlled manual Flashcard visual-review data.",
      },
    });

    const journey = await transaction.vOCABULARY.create({
      data: {
        word: "travel",
        phonetic: "/ˈdʒɜːni/",
        meanings: {
          create: [
            {
              part_of_speech: "noun",
              meaning_vi: "quá trình hoặc trải nghiệm dài",
              context: "Nghĩa trừu tượng được tạo trước nhưng CEFR cao hơn.",
              cefr_level: "B2",
              examples: {
                create: [{
                  example_en: "Learning English is a rewarding journey.",
                  example_vi: "Học tiếng Anh là một hành trình đáng giá.",
                }],
              },
            },
            {
              part_of_speech: "noun",
              meaning_vi: "chuyến đi",
              context: "Di chuyển từ nơi này đến nơi khác.",
              cefr_level: "A1",
              examples: {
                create: [
                  {
                    example_en: "The train journey takes two hours.",
                    example_vi: "Chuyến đi bằng tàu mất hai giờ.",
                  },
                  {
                    example_en: "We started our journey early.",
                    example_vi: "Chúng tôi bắt đầu chuyến đi từ sớm.",
                  },
                ],
              },
            },
          ],
        },
      },
    });

    const book = await transaction.vOCABULARY.create({
      data: {
        word: "book",
        phonetic: "/bʊk/",
        meanings: {
          create: [
            {
              part_of_speech: "verb",
              meaning_vi: "đặt trước",
              context: "Dùng khi đặt vé hoặc chỗ ở.",
              cefr_level: "B1",
              examples: {
                create: [{
                  example_en: "I booked a room near the station.",
                  example_vi: "Tôi đã đặt một phòng gần nhà ga.",
                }],
              },
            },
            {
              part_of_speech: "noun",
              meaning_vi: "quyển sách",
              context: "Một tác phẩm được in hoặc xuất bản điện tử.",
              cefr_level: "A2",
              examples: {
                create: [{
                  example_en: "This book has clear examples.",
                  example_vi: "Quyển sách này có các ví dụ rõ ràng.",
                }],
              },
            },
          ],
        },
      },
    });

    const committee = await transaction.vOCABULARY.create({
      data: {
        word: "committee",
        phonetic: "/kəˈmɪti/",
        meanings: {
          create: [{
            part_of_speech: "noun",
            meaning_vi: "ủy ban",
            context: "Nhóm người được chọn để thực hiện một nhiệm vụ.",
            cefr_level: null,
            examples: {
              create: [{
                example_en: "The committee meets every Friday.",
                example_vi: "Ủy ban họp vào mỗi thứ Sáu.",
              }],
            },
          }],
        },
      },
    });

    const resilient = await createVisualVocabulary(transaction, {
      word: "resilient",
      meaningVi: "kiên cường, nhanh chóng phục hồi",
      exampleEn: "She remained resilient after the setback.",
    });

    const fixedSeparator = await createVisualVocabulary(transaction, {
      word: "mother-in-law",
      meaningVi: "mẹ chồng hoặc mẹ vợ",
      exampleEn: "Her mother-in-law enjoys gardening.",
    });
    const oneCharacter = await createVisualVocabulary(transaction, {
      word: "a",
      meaningVi: "một; một người hoặc vật",
      exampleEn: "I saw a bird.",
    });
    const allIdentical = await createVisualVocabulary(transaction, {
      word: "ooo",
      meaningVi: "chuỗi ký tự giống nhau dùng để kiểm tra giao diện",
      exampleEn: "This controlled item exercises identity fallback.",
    });
    const longPhrase = await createVisualVocabulary(transaction, {
      word: "extraordinarily long vocabulary phrase",
      meaningVi: "cụm từ dài có chủ đích để kiểm tra xuống dòng",
      exampleEn: "This intentionally long phrase checks responsive wrapping.",
    });

    const set = await transaction.vOCABULARY_SET.create({
      data: {
        topic_id: topic.id,
        owner_id: user.id,
        name: `${fixture.prefix} Flashcard Review Set`,
        description: "Three ordered cards for manual responsive and interaction review.",
        is_public: false,
        items: {
          create: [
            { vocabulary_id: book.id, position: 1 },
            { vocabulary_id: journey.id, position: 2 },
            { vocabulary_id: committee.id, position: 3 },
            { vocabulary_id: resilient.id, position: 4 },
            { vocabulary_id: fixedSeparator.id, position: 5 },
            { vocabulary_id: oneCharacter.id, position: 6 },
            { vocabulary_id: allIdentical.id, position: 7 },
            { vocabulary_id: longPhrase.id, position: 8 },
          ],
        },
      },
    });

    await Promise.all([
      transaction.lEARNING_PROGRESS.create({
        data: {
          user_id: user.id,
          vocabulary_id: book.id,
          status: "LEARNING",
          review_count: 2,
          revision: 2,
          last_reviewed_at: new Date("2026-09-22T08:00:00.000Z"),
        },
      }),
      transaction.lEARNING_PROGRESS.create({
        data: {
          user_id: user.id,
          vocabulary_id: journey.id,
          status: "LEARNED",
          review_count: 5,
          revision: 5,
          last_reviewed_at: new Date("2026-09-23T08:00:00.000Z"),
        },
      }),
      transaction.lEARNING_PROGRESS.create({
        data: {
          user_id: user.id,
          vocabulary_id: resilient.id,
          status: "NEEDS_REVIEW",
          review_count: 3,
          revision: 3,
          last_reviewed_at: new Date("2026-09-21T08:00:00.000Z"),
        },
      }),
    ]);

    return { setId: set.id };
  }, { maxWait: 30_000, timeout: 120_000 });

  console.log("Manual Learning visual fixture created in the guarded TEST database.");
  console.log(`Email: ${fixture.email}`);
  console.log(`Password: ${PASSWORD}`);
  console.log(`Learning path: /learn/vocabulary-sets/${result.setId}`);
  console.log("Progress path: /my/learning-progress");
  console.log(`Cleanup run ID: ${runId}`);
}

async function createVisualVocabulary(transaction, { word, meaningVi, exampleEn }) {
  return transaction.vOCABULARY.create({
    data: {
      word,
      meanings: {
        create: [{
          part_of_speech: "noun",
          meaning_vi: meaningVi,
          context: "Controlled Quiz visual-review case.",
          cefr_level: "A2",
          examples: { create: [{ example_en: exampleEn }] },
        }],
      },
    },
  });
}

async function cleanupFixture(prisma) {
  const fixture = fixtureIdentity(runId);
  const counts = await prisma.$transaction(async (transaction) => {
    const users = await transaction.uSER.findMany({
      where: { email: fixture.email },
      select: { id: true },
    });
    const userIds = users.map(({ id }) => id);
    const controlledSets = await transaction.vOCABULARY_SET.findMany({
      where: {
        name: { startsWith: fixture.prefix },
        owner_id: { in: userIds },
      },
      include: { items: { select: { vocabulary_id: true } } },
    });
    const ownedSets = await transaction.vOCABULARY_SET.findMany({
      where: { owner_id: { in: userIds } },
      select: { id: true },
    });
    const ownedSetIds = ownedSets.map(({ id }) => id);
    const vocabularyIds = [...new Set(controlledSets.flatMap(({ items }) =>
      items.map(({ vocabulary_id: vocabularyId }) => vocabularyId)))];

    const progress = await transaction.lEARNING_PROGRESS.deleteMany({
      where: {
        OR: [
          { user_id: { in: userIds } },
          { vocabulary_id: { in: vocabularyIds } },
        ],
      },
    });
    const sessions = await transaction.aUTH_SESSION.deleteMany({
      where: { user_id: { in: userIds } },
    });
    const setItems = await transaction.vOCABULARY_SET_ITEM.deleteMany({
      where: { vocabulary_set_id: { in: ownedSetIds } },
    });
    const sets = await transaction.vOCABULARY_SET.deleteMany({
      where: { owner_id: { in: userIds } },
    });
    const stillReferenced = await transaction.vOCABULARY_SET_ITEM.findMany({
      where: { vocabulary_id: { in: vocabularyIds } },
      select: { vocabulary_id: true },
      distinct: ["vocabulary_id"],
    });
    const referencedIds = new Set(stillReferenced.map(({ vocabulary_id: vocabularyId }) => vocabularyId));
    const deletableVocabularyIds = vocabularyIds.filter((id) => !referencedIds.has(id));
    const vocabulary = await transaction.vOCABULARY.deleteMany({
      where: { id: { in: deletableVocabularyIds } },
    });
    const topics = await transaction.tOPIC.deleteMany({
      where: {
        name: { startsWith: fixture.prefix },
        vocabulary_sets: { none: {} },
      },
    });
    const removedUsers = await transaction.uSER.deleteMany({
      where: { id: { in: userIds } },
    });

    return {
      progress: progress.count,
      sessions: sessions.count,
      setItems: setItems.count,
      sets: sets.count,
      vocabularies: vocabulary.count,
      topics: topics.count,
      users: removedUsers.count,
    };
  }, { maxWait: 30_000, timeout: 120_000 });

  console.log("Manual Learning visual fixture targeted cleanup complete.");
  console.log(`Removed controlled records: ${JSON.stringify(counts)}`);
}

async function findControlledData(prisma, fixture) {
  const [users, topics, sets] = await Promise.all([
    prisma.uSER.count({ where: { email: fixture.email } }),
    prisma.tOPIC.count({ where: { name: { startsWith: fixture.prefix } } }),
    prisma.vOCABULARY_SET.count({ where: { name: { startsWith: fixture.prefix } } }),
  ]);
  return { total: users + topics + sets };
}

function fixtureIdentity(id) {
  return {
    prefix: `Manual-Learning-${id}`,
    email: `manual-learning-${id.toLowerCase()}@example.test`,
  };
}

function safeError(error) {
  return error?.code ? `${error.code} (${error.name ?? "Error"})` : error?.message ?? "Unknown error";
}
