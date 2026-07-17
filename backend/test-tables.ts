import { PrismaClient } from '@prisma/client';
import { getAllTables } from './src/services/table.service';

const prisma = new PrismaClient();

async function run() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) return;
  const tables = await getAllTables(true, tenant.id);
  console.log(tables.map(t => ({ tableNumber: t.tableNumber, isExcess: t.isExcess })));
}
run();
