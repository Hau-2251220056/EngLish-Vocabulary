// @ts-nocheck
import express from "express";
import { PrismaClient } from "./generated/prisma/client.ts";
import { createApp } from "./create-app.js";

// Keep Express as a direct import for Vercel's zero-config entry detection.
void express;

const prisma = new PrismaClient();

export default createApp({ prisma });
