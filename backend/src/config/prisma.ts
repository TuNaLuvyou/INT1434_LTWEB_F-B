import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

// Sử dụng DATABASE_URL cho môi trường chạy ứng dụng chính (được tối ưu với PgBouncer nếu có)
// Nếu không có, fallback về DIRECT_URL
const connectionString = process.env.DATABASE_URL || process.env.DIRECT_URL;

const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);

// Khởi tạo Prisma Client với Adapter pg
const prisma = new PrismaClient({ adapter });

export default prisma;
