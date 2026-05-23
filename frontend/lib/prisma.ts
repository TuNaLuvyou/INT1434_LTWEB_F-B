/**
 * prisma.ts — Singleton Prisma Client cho Next.js
 *
 * Next.js hot reload trong dev tạo nhiều PrismaClient instances → connection leak.
 * Giải pháp: lưu instance vào global để reuse qua các hot reloads.
 */

import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: pg.Pool | undefined;
};

const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;
const pool = globalForPrisma.pgPool ?? new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
  globalForPrisma.pgPool = pool;
}

export default prisma;
