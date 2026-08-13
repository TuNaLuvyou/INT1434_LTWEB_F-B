import prisma from '../config/prisma';
import { logger } from '../utils/logger';

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
    logger.info('Cleanup', `Threshold 95 days ago: ${thresholdDate.toISOString()} (${thresholdDate.toString()})`);

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
    logger.info('Cleanup', `Found ${sessionIds.length} old order sessions to clean.`);

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

    logger.info('Cleanup', `Cleanup finished: payments=${deletedPaymentsResult.count}, orderItems=${deletedOrderItemsResult.count}, sessions=${deletedSessionsResult.count}`);

    return {
      success: true,
      deletedSessions: deletedSessionsResult.count,
      deletedPayments: deletedPaymentsResult.count,
      deletedOrderItems: deletedOrderItemsResult.count
    };
  } catch (error: any) {
    logger.error('Cleanup', 'Failed to clean old order history:', error);
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
  logger.info('Cleanup', 'Automatic cleanup job for old order history (> 95 days) initialized...');
  
  // Chạy lần đầu tiên sau khi khởi động server 5 giây (đảm bảo database đã kết nối ổn định)
  setTimeout(async () => {
    logger.info('Cleanup', 'First automatic cleanup scan on server startup...');
    await cleanupOldSessions();
  }, 5000);

  // Thiết lập lặp lại đều đặn mỗi 24 giờ
  cleanupInterval = setInterval(async () => {
    logger.info('Cleanup', 'Running daily cleanup job...');
    await cleanupOldSessions();
  }, 24 * 60 * 60 * 1000);
}

// stopAutomaticCleanupJob was removed — unused export
