// @ts-nocheck
import { PrismaClient } from "./generated/prisma/client.ts";
import { createApp } from "./app.js";

const prisma = new PrismaClient();

export default createApp({ prisma });
