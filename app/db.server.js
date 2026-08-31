import { PrismaClient } from "@prisma/client";
import { assertSafeNonProductionDatabase } from "./lib/database-environment.server.js";

assertSafeNonProductionDatabase();

if (process.env.NODE_ENV !== "production") {
  if (!global.prismaGlobal) {
    global.prismaGlobal = new PrismaClient();
  }
}

const prisma = global.prismaGlobal ?? new PrismaClient();

export default prisma;
