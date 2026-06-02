import prisma from './config/prisma';

async function run() {
  console.log("=== CHECK PAYMENTS FOR MAY 28 ===");
  const payments = await prisma.payment.findMany({
    include: { session: { include: { table: true } } }
  });
  console.log("Total payments count:", payments.length);
  payments.forEach(p => {
    const d = p.paidAt;
    const isMay28 = d.getDate() === 28 && d.getMonth() === 4 && d.getFullYear() === 2026;
    console.log(`- Payment: id=${p.id}, total=${p.total}, paidAt=${p.paidAt.toISOString()} (isMay28: ${isMay28})`);
  });

  console.log("\n=== CHECK CANCELLED SESSIONS FOR MAY 28 ===");
  const sessions = await prisma.tableSession.findMany({
    where: { status: 'CANCELLED' },
    include: { table: true }
  });
  console.log("Total cancelled sessions count:", sessions.length);
  sessions.forEach(s => {
    const isOpenedMay28 = s.openedAt && s.openedAt.getDate() === 28 && s.openedAt.getMonth() === 4 && s.openedAt.getFullYear() === 2026;
    const isClosedMay28 = s.closedAt && s.closedAt.getDate() === 28 && s.closedAt.getMonth() === 4 && s.closedAt.getFullYear() === 2026;
    if (isOpenedMay28 || isClosedMay28) {
      console.log(`- MATCH Session: id=${s.id}, openedAt=${s.openedAt?.toISOString()}, closedAt=${s.closedAt?.toISOString()}`);
    }
  });
}

run()
  .catch(err => console.error(err))
  .finally(() => prisma.$disconnect());
