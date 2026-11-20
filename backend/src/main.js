// @ts-nocheck
import { PrismaClient } from "./generated/prisma/client.ts";
import { createApp } from "./create-app.js";

const PORT = process.env.PORT || 5000;
const prisma = new PrismaClient();
const app = createApp({ prisma });

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
