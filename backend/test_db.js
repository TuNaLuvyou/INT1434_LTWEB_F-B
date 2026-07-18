const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient({ adapter: null, accelerateUrl: undefined }); // Prevent error
async function main() {
  const sessions = await prisma.tableSession.findMany({
    where: { status: 'OPEN', tableId: '5e236446-8f92-49a6-a5ca-2cb11db7cda0' }, // Table 1
  });
  console.log("OPEN SESSIONS FOR TABLE 1:", sessions);
}
main().catch(console.error).finally(() => prisma.$disconnect());
