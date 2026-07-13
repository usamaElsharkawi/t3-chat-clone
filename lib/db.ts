import { Pool } from "pg";
import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Neon (and other serverless Postgres) compute can scale to zero and take a few
// seconds to "wake up" on a cold connection. The default pg connection timeout
// is short, which causes intermittent PrismaClientKnownRequestError (P1001)
// "Can't reach database server" errors mid-query. Use a generous timeout and a
// bounded pool so cold starts succeed and we don't exhaust Neon's connection limit.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 30_000,
  idleTimeoutMillis: 30_000,
  max: 5,
})

const adapter = new PrismaPg(pool);

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  adapter: adapter,
})

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
} 

