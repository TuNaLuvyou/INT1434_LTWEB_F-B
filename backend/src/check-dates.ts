import prisma from './config/prisma';

async function run() {
  console.log("=== CHECK PAYMENTS ===");
  const payments = await prisma.payment.findMany({
    include: {
      session: {
        include: {
          table: true
        }
      }
    }
  });
  console.log(`Found ${payments.length} payments:`);
  payments.forEach(p => {
    console.log(`- ID: ${p.id}, Total: ${p.total}, paidAt: ${p.paidAt.toISOString()} (Local: ${p.paidAt.toString()}), Table: ${p.session?.table?.label || p.session?.tableId}`);
  });

  console.log("\n=== CHECK CANCELLED SESSIONS ===");
  const cancelled = await prisma.tableSession.findMany({
    where: { status: 'CANCELLED' },
    include: { table: true }
  });
  console.log(`Found ${cancelled.length} cancelled sessions:`);
  cancelled.forEach(s => {
    console.log(`- ID: ${s.id}, status: ${s.status}, openedAt: ${s.openedAt?.toISOString()} (Local: ${s.openedAt?.toString()}), closedAt: ${s.closedAt?.toISOString()} (Local: ${s.closedAt?.toString()}), Table: ${s.table?.label || s.tableId}`);
  });
}

run()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
