const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const latestSessions = await prisma.tableSession.findMany({
    orderBy: { openedAt: 'desc' },
    take: 3,
    include: { orderItems: true }
  });
  console.log(JSON.stringify(latestSessions, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
