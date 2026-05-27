import prisma from './config/prisma';

async function checkAllItems() {
  console.log('🔍 Listing all OrderItems and Sessions in the database...\n');

  try {
    const allSessions = await prisma.tableSession.findMany({
      include: {
        table: true,
        orderItems: {
          include: {
            menuItem: true,
          },
        },
      },
      orderBy: { openedAt: 'desc' },
      take: 10,
    });

    console.log(`📊 Tổng số phiên (TableSession) gần nhất: ${allSessions.length}`);
    for (const session of allSessions) {
      console.log(`\n======================================================`);
      console.log(`🛋️ BÀN ${session.table.tableNumber} | Trạng thái phiên: ${session.status}`);
      console.log(`🔑 Session ID: ${session.id}`);
      console.log(`🔒 LockedAt (Duyệt): ${session.lockedAt} | ClosedAt: ${session.closedAt}`);
      console.log(`📦 Số lượng OrderItems: ${session.orderItems.length}`);
      
      session.orderItems.forEach((item, index) => {
        console.log(`   [${index + 1}] "${item.menuItem.name}" | SL: x${item.qty} | Trạng thái: ${item.status} | ID: ${item.id}`);
      });
    }

    const orphanedItems = await prisma.orderItem.findMany({
      where: {
        sessionId: {
          notIn: allSessions.map(s => s.id)
        }
      },
      include: {
        menuItem: true,
      }
    });
    console.log(`\n📊 Số OrderItems không thuộc 10 phiên gần nhất: ${orphanedItems.length}`);

  } catch (error: any) {
    console.error('❌ Lỗi khi đọc database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllItems();
