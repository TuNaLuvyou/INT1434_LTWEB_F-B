import dotenv from 'dotenv';
dotenv.config();
import prisma from './src/config/prisma';
import { TableService } from './src/services/table.service';
import { getCashierOverview } from './src/services/cashier.service';

async function run() {
  const tenant = await prisma.tenant.findFirst();
  if (!tenant) return;
  const tables = await TableService.getAllTables(true, tenant.id);
  console.log('Tables:', tables.map(t => ({ tableNumber: t.tableNumber, isExcess: (t as any).isExcess })));
  
  const cashierTables = await getCashierOverview(tenant.id);
  console.log('Cashier tables:', cashierTables.map(t => ({ tableNumber: t.tableNumber, isExcess: t.isExcess })));
}
run();
