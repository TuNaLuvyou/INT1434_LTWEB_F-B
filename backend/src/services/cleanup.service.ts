import prisma from '../config/prisma';

/**
 * Thực hiện tìm kiếm và xóa tất cả các phiên TableSession, Payment và OrderItem cũ hơn 90 ngày.
 * Quy trình thực hiện qua Prisma Transaction để đảm bảo tính toàn vẹn dữ liệu tuyệt đối.
 */
export async function cleanupOldSessions(): Promise<{ 
  success: boolean; 
  deletedSessions: number; 
  deletedPayments: number; 
  deletedOrderItems: number; 
  error?: string; 
}> {
  try {
    // Thời điểm cách đây 95 ngày
    const thresholdDate = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);
    console.log(`[Cleanup Job] Mốc thời gian 95 ngày trước: ${thresholdDate.toISOString()} (${thresholdDate.toString()})`);

    // 1. Tìm tất cả các TableSession cũ hơn 95 ngày
    const sessions = await prisma.tableSession.findMany({
      where: {
        openedAt: {
          lt: thresholdDate
        }
      },
      select: {
        id: true
      }
    });

    const sessionIds = sessions.map(s => s.id);
    console.log(`[Cleanup Job] Phát hiện ${sessionIds.length} phiên đơn hàng cần dọn dẹp.`);

    if (sessionIds.length === 0) {
      return {
        success: true,
        deletedSessions: 0,
        deletedPayments: 0,
        deletedOrderItems: 0
      };
    }

    // 2. Thực thi xóa tuần tự các liên kết trong cùng một Transaction
    const [deletedPaymentsResult, deletedOrderItemsResult, deletedSessionsResult] = await prisma.$transaction([
      // A. Xóa tất cả Payment liên kết với các Session này
      prisma.payment.deleteMany({
        where: {
          sessionId: { in: sessionIds }
        }
      }),
      // B. Xóa tất cả các món ăn đã gọi (OrderItem) liên kết với các Session này (lịch sử bếp/order)
      prisma.orderItem.deleteMany({
        where: {
          sessionId: { in: sessionIds }
        }
      }),
      // C. Xóa chính bản ghi phiên TableSession
      prisma.tableSession.deleteMany({
        where: {
          id: { in: sessionIds }
        }
      })
    ]);

    console.log(`[Cleanup Job] 🎉 Hoàn tất dọn dẹp lịch sử đơn hàng cũ hơn 95 ngày thành công:`);
    console.log(`  > Số hóa đơn Payment đã xóa: ${deletedPaymentsResult.count}`);
    console.log(`  > Số OrderItem (bếp/pos) đã xóa: ${deletedOrderItemsResult.count}`);
    console.log(`  > Số phiên TableSession đã xóa: ${deletedSessionsResult.count}`);

    return {
      success: true,
      deletedSessions: deletedSessionsResult.count,
      deletedPayments: deletedPaymentsResult.count,
      deletedOrderItems: deletedOrderItemsResult.count
    };
  } catch (error: any) {
    console.error(`[Cleanup Job] ❌ Lỗi nghiêm trọng khi thực hiện dọn dẹp lịch sử đơn hàng:`, error);
    return {
      success: false,
      deletedSessions: 0,
      deletedPayments: 0,
      deletedOrderItems: 0,
      error: error.message || String(error)
    };
  }
}

let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Đăng ký tác vụ dọn dẹp chạy nền tự động.
 * Tác vụ sẽ chạy 1 lần sau 5 giây khi server bắt đầu hoạt động, sau đó lặp lại sau mỗi 24 giờ.
 */
export function startAutomaticCleanupJob() {
  console.log('[Cleanup Job] 🕒 Khởi tạo tác vụ tự động dọn dẹp lịch sử đơn hàng cũ (> 95 ngày)...');
  
  // Chạy lần đầu tiên sau khi khởi động server 5 giây (đảm bảo database đã kết nối ổn định)
  setTimeout(async () => {
    console.log('[Cleanup Job] 🚀 Đang tự động quét dọn lịch sử cũ lần đầu tiên khi server khởi động...');
    await cleanupOldSessions();
  }, 5000);

  // Thiết lập lặp lại đều đặn mỗi 24 giờ
  cleanupInterval = setInterval(async () => {
    console.log('[Cleanup Job] ⏰ Đang tiến hành dọn dẹp định kỳ hàng ngày...');
    await cleanupOldSessions();
  }, 24 * 60 * 60 * 1000);
}

/**
 * Dừng tác vụ chạy nền (dùng khi tắt hoặc reload server)
 */
export function stopAutomaticCleanupJob() {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('[Cleanup Job] 🛑 Đã dừng tác vụ tự động dọn dẹp.');
  }
}
