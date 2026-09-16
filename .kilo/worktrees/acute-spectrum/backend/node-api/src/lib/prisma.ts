import { PrismaClient } from "@prisma/client";

// Single shared Prisma client instance (Prisma manages its own connection pool).
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
});

export default prisma;
