import { PrismaClient } from "../../src/generated/prisma/client.ts";
import sharp from "sharp";
import { createApp } from "../../src/create-app.js";
import { createVocabularySetCoverImageProcessor } from "../../src/images/vocabulary-set-cover-image-processor.js";
import { createVocabularySetCoverStorage } from "../../src/storage/vocabulary-set-cover-storage.js";
import { hashPassword } from "../../src/utils/password-security.js";
import {
  configureTestEnvironment,
  configureTestStorageEnvironment,
} from "../helpers/test-environment.js";

configureTestEnvironment({ requireReset: true });
configureTestStorageEnvironment();

const prisma = new PrismaClient();
const ids = {
  admin: "55100000-0000-4000-8000-000000000001",
  user: "55100000-0000-4000-8000-000000000002",
  primaryTopic: "55100000-0000-4000-8000-000000000003",
  vocabulary: "55100000-0000-4000-8000-000000000004",
  systemManaged: "55100000-0000-4000-8000-000000000005",
  personalManaged: "55100000-0000-4000-8000-000000000006",
  systemBroken: "55100000-0000-4000-8000-000000000007",
  systemMissing: "55100000-0000-4000-8000-000000000008",
  personalLegacy: "55100000-0000-4000-8000-000000000009",
  secondaryTopic: "55100000-0000-4000-8000-000000000010",
  personalExternal: "55100000-0000-4000-8000-000000000011",
  personalBroken: "55100000-0000-4000-8000-000000000012",
  personalMissing: "55100000-0000-4000-8000-000000000013",
  catalog: Array.from(
    { length: 10 },
    (_, index) => `55100000-0000-4000-8000-${String(index + 14).padStart(12, "0")}`,
  ),
};
const password = "Metadata-Review-2026!";
const coverStorage = createVocabularySetCoverStorage();
const managedSetIds = [ids.systemManaged, ids.personalManaged];

await prisma.$connect();
const password_hash = await hashPassword(password);
await prisma.uSER.upsert({
  where: { email: "metadata-admin@manual.test" },
  update: { password_hash, display_name: "Metadata Admin", role: "ADMIN", is_active: true },
  create: { id: ids.admin, email: "metadata-admin@manual.test", password_hash, display_name: "Metadata Admin", role: "ADMIN", is_active: true },
});
await prisma.uSER.upsert({
  where: { email: "metadata-user@manual.test" },
  update: { password_hash, display_name: "Metadata Learner", role: "USER", is_active: true },
  create: { id: ids.user, email: "metadata-user@manual.test", password_hash, display_name: "Metadata Learner", role: "USER", is_active: true },
});
await prisma.tOPIC.upsert({
  where: { id: ids.primaryTopic },
  update: { name: "Metadata review" },
  create: { id: ids.primaryTopic, name: "Metadata review" },
});
await prisma.tOPIC.upsert({
  where: { id: ids.secondaryTopic },
  update: { name: "Metadata practice" },
  create: { id: ids.secondaryTopic, name: "Metadata practice" },
});
await prisma.vOCABULARY.upsert({
  where: { id: ids.vocabulary },
  update: { word: "metadata" },
  create: { id: ids.vocabulary, word: "metadata", phonetic: "/ˈmetədeɪtə/" },
});

for (const setId of managedSetIds) await coverStorage.removeSetObjects({ setId });
const systemManagedCover = await uploadReviewCover({ setId: ids.systemManaged, color: "#4ca2e6" });
const personalManagedCover = await uploadReviewCover({ setId: ids.personalManaged, color: "#7ed321" });

const catalogCefr = ["A1", "A2", "B1", "B2", "C1", "A1", "A2", "B1", "B2", "C1"];
const catalogSets = ids.catalog.map((id, index) => ({
  id,
  owner_id: ids.admin,
  topic_id: index % 2 === 0 ? ids.primaryTopic : ids.secondaryTopic,
  name: `Review Catalog ${String(index + 1).padStart(2, "0")} ${catalogCefr[index]}`,
  description: `${index < 5 ? "Search alpha" : "Search beta"} pagination review`,
  cefr_level: catalogCefr[index],
  cover_image_url: index === 0
    ? "https://images.unsplash.com/photo-1524995997946-a1c2e315a42f"
    : null,
  cover_storage_key: null,
  is_public: true,
}));
const reviewSets = [
  {
    id: ids.systemManaged,
    owner_id: ids.admin,
    topic_id: ids.primaryTopic,
    name: "MANUAL Metadata System",
    description: "ADMIN managed-cover and metadata review",
    cefr_level: "A2",
    cover_image_url: systemManagedCover.url,
    cover_storage_key: systemManagedCover.key,
    is_public: true,
  },
  {
    id: ids.systemBroken,
    owner_id: ids.admin,
    topic_id: ids.primaryTopic,
    name: "MANUAL Metadata Broken Cover",
    description: "B1 broken-cover fallback review",
    cefr_level: "B1",
    cover_image_url: "https://invalid.example.test/broken-cover.webp",
    cover_storage_key: null,
    is_public: true,
  },
  {
    id: ids.systemMissing,
    owner_id: ids.admin,
    topic_id: ids.secondaryTopic,
    name: "MANUAL Metadata Missing Cover",
    description: "C1 missing-cover fallback review",
    cefr_level: "C1",
    cover_image_url: null,
    cover_storage_key: null,
    is_public: true,
  },
  ...catalogSets,
  {
    id: ids.personalManaged,
    owner_id: ids.user,
    topic_id: null,
    name: "MANUAL Metadata Personal Managed",
    description: "Personal Set with a managed TEST cover and CEFR",
    cefr_level: "A2",
    cover_image_url: personalManagedCover.url,
    cover_storage_key: personalManagedCover.key,
    is_public: false,
  },
  {
    id: ids.personalExternal,
    owner_id: ids.user,
    topic_id: null,
    name: "MANUAL Metadata Personal External",
    description: "Personal Set with an external HTTPS cover",
    cefr_level: "B1",
    cover_image_url: "https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8",
    cover_storage_key: null,
    is_public: false,
  },
  {
    id: ids.personalBroken,
    owner_id: ids.user,
    topic_id: null,
    name: "MANUAL Metadata Personal Broken",
    description: "Personal broken-cover fallback review",
    cefr_level: "C1",
    cover_image_url: "https://invalid.example.test/personal-broken.webp",
    cover_storage_key: null,
    is_public: false,
  },
  {
    id: ids.personalMissing,
    owner_id: ids.user,
    topic_id: null,
    name: "MANUAL Metadata Personal Missing",
    description: "Personal missing-cover fallback review",
    cefr_level: "A1",
    cover_image_url: null,
    cover_storage_key: null,
    is_public: false,
  },
  {
    id: ids.personalLegacy,
    owner_id: ids.user,
    topic_id: null,
    name: "MANUAL Metadata Legacy Personal",
    description: "Legacy null metadata review",
    cefr_level: null,
    cover_image_url: null,
    cover_storage_key: null,
    is_public: false,
  },
];

try {
  await prisma.$transaction(async (tx) => {
    const reviewSetIds = reviewSets.map(({ id }) => id);
    await tx.vOCABULARY_SET_ITEM.deleteMany({
      where: { vocabulary_set_id: { in: reviewSetIds } },
    });
    for (const set of reviewSets) {
      await tx.vOCABULARY_SET.upsert({
        where: { id: set.id },
        update: set,
        create: set,
      });
    }
    await tx.vOCABULARY_SET_ITEM.createMany({
      data: reviewSetIds.map((vocabulary_set_id) => ({
        vocabulary_set_id,
        vocabulary_id: ids.vocabulary,
        position: 1,
      })),
    });
  }, { timeout: 30_000 });
} catch (error) {
  await Promise.allSettled(managedSetIds.map((setId) => coverStorage.removeSetObjects({ setId })));
  throw error;
}

const app = createApp({
  prisma,
  coverStorage,
  coverImageProcessor: createVocabularySetCoverImageProcessor(),
});
const server = app.listen(5000, "127.0.0.1", () => {
  console.log("Manual metadata backend: http://127.0.0.1:5000");
  console.log("ADMIN: metadata-admin@manual.test / Metadata-Review-2026!");
  console.log("USER: metadata-user@manual.test / Metadata-Review-2026!");
  console.log("Dedicated TEST Storage adapter active.");
});

async function uploadReviewCover({ setId, color }) {
  const buffer = await sharp({
    create: { width: 1200, height: 720, channels: 3, background: color },
  }).webp({ quality: 82 }).toBuffer();
  return coverStorage.upload({ setId, buffer });
}

async function stop() {
  server.close(async () => { await prisma.$disconnect(); process.exit(0); });
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
