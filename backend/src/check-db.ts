import prisma from './config/prisma';

async function checkDb() {
  console.log('🔍 Checking database for active sessions and order items...\n');

  try {
    // 1. Lấy ra danh sách các TableSession đang OPEN
    const activeSessions = await prisma.tableSession.findMany({
      where: { status: 'OPEN' },
      include: {
        table: true,
        orderItems: {
          include: {
            menuItem: true,
          },
        },
      },
    });

    console.log(`📊 Tìm thấy ${activeSessions.length} phiên đang mở:`);
    for (const session of activeSessions) {
      console.log(`\n======================================================`);
      console.log(`🛋️ BÀN ${session.table.tableNumber} (ID Bàn: ${session.tableId})`);
      console.log(`🔑 ID Phiên (SessionId): ${session.id}`);
      console.log(`🔒 LockedAt (Đã duyệt): ${session.lockedAt}`);
      console.log(`📦 Số lượng món trong session: ${session.orderItems.length}`);
      
      session.orderItems.forEach((item, index) => {
        console.log(`   [${index + 1}] Món: "${item.menuItem.name}" | SL: x${item.qty} | Trạng thái: ${item.status} | ID: ${item.id}`);
      });
    }

  } catch (error: any) {
    console.error('❌ Lỗi khi đọc database:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

checkDb();
