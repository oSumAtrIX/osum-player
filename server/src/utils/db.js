import { PrismaClient } from "@prisma/client";

/**
 * @type {import('@prisma/client').PrismaClient}
 */
const db = new PrismaClient();

export default db;
