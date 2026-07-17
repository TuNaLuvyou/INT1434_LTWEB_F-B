import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import 'dotenv/config';

const pool = new pg.Pool({ connectionString: process.env.DIRECT_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: { name: 'ChinyoTea' }
  });

  if (tenants.length === 0) {
    console.log('Không tìm thấy tenant ChinyoTea');
    return;
  }

  for (const t of tenants) {
    await prisma.tenant.delete({
      where: { id: t.id }
    });
    console.log(`Đã xoá tenant: ${t.name} (ID: ${t.id})`);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
