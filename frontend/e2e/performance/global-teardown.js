import { cleanupPerformanceFixture } from "./fixture.js";

export default async function globalTeardown() {
  await cleanupPerformanceFixture();
}
