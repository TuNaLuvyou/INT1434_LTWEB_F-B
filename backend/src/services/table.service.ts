import prisma from '../config/prisma';
import { TableStatus } from '@prisma/client';
import { AppError } from '../utils/app-error';

export interface TableWithSession {
  id: string;
  tableNumber: number;
  label: string;
  status: TableStatus;
  createdAt: Date;
  updatedAt: Date;
  sessionId: string | null;
  activeSession?: {
    openedAt: Date;
    orderItemsCount: number;
  } | null;
}

export class TableService {
  /**
   * Lấy danh sách tất cả các bàn, sắp xếp theo số bàn tăng dần.
   * Nếu là Admin/Manager, include thêm session đang OPEN để hiển thị trên sơ đồ bàn.
   */
  static async getAllTables(isAdmin: boolean): Promise<TableWithSession[]> {
    const tables = await prisma.table.findMany({
      orderBy: {
        tableNumber: 'asc',
      },
      include: {
        sessions: isAdmin
          ? {
              where: {
                status: 'OPEN',
              },
              include: {
                orderItems: {
                  where: {
                    status: {
                      in: ['PENDING', 'PREPARING', 'DONE'],
                    },
                  },
                },
              },
            }
          : false,
      },
    });

    return tables.map((t) => {
      const activeSession = isAdmin && t.sessions && t.sessions.length > 0 ? (t.sessions[0] as any) : null;
      return {
        id: t.id,
        tableNumber: t.tableNumber,
        label: t.label,
        status: t.status,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
        sessionId: activeSession ? activeSession.id : null,
        activeSession: activeSession
          ? {
              openedAt: activeSession.openedAt,
              orderItemsCount: activeSession.orderItems.reduce((acc: number, item: any) => acc + item.qty, 0),
            }
          : null,
      };
    });
  }

  /**
   * Tạo bàn mới. Đảm bảo tableNumber là unique.
   */
  static async createTable(tableNumber: number, label: string) {
    if (!label || label.trim().length === 0) {
      throw new AppError(400, 'BAD_REQUEST', 'Tên bàn không được để trống.');
    }

    if (tableNumber < 1 || tableNumber > 99) {
      throw new AppError(400, 'BAD_REQUEST', 'Số bàn phải từ 1 đến 99.');
    }

    // Kiểm tra trùng số bàn
    const existingTable = await prisma.table.findUnique({
      where: { tableNumber },
    });

    if (existingTable) {
      throw new AppError(400, 'BAD_REQUEST', `Số bàn ${tableNumber} đã tồn tại trong hệ thống.`);
    }

    return prisma.table.create({
      data: {
        tableNumber,
        label: label.trim(),
        status: TableStatus.AVAILABLE,
      },
    });
  }

  /**
   * Cập nhật thông tin bàn (label, status).
   * Không cho phép sửa đổi tableNumber để tránh hỏng mã QR đã in.
   */
  static async updateTable(id: string, label?: string, status?: TableStatus) {
    const table = await prisma.table.findUnique({
      where: { id },
    });

    if (!table) {
      throw new AppError(404, 'NOT_FOUND', 'Bàn không tồn tại.');
    }

    const dataToUpdate: { label?: string; status?: TableStatus } = {};

    if (label !== undefined) {
      if (label.trim().length === 0) {
        throw new AppError(400, 'BAD_REQUEST', 'Tên bàn không được để trống.');
      }
      dataToUpdate.label = label.trim();
    }

    if (status !== undefined) {
      if (!Object.values(TableStatus).includes(status)) {
        throw new AppError(400, 'BAD_REQUEST', 'Trạng thái bàn không hợp lệ.');
      }
      dataToUpdate.status = status;

      // Nếu chuyển trạng thái về AVAILABLE, tự động đóng (CANCELLED) các session đang OPEN của bàn này
      if (status === TableStatus.AVAILABLE) {
        await prisma.tableSession.updateMany({
          where: {
            tableId: id,
            status: 'OPEN',
          },
          data: {
            status: 'CANCELLED',
            closedAt: new Date(),
          },
        });
      }
    }

    return prisma.table.update({
      where: { id },
      data: dataToUpdate,
    });
  }

  /**
   * Xóa bàn. Không cho phép xóa nếu bàn đang có session OPEN (đang có khách ăn).
   */
  static async deleteTable(id: string) {
    const table = await prisma.table.findUnique({
      where: { id },
      include: {
        sessions: {
          where: {
            status: 'OPEN',
          },
        },
      },
    });

    if (!table) {
      throw new AppError(404, 'NOT_FOUND', 'Bàn không tồn tại.');
    }

    if (table.sessions.length > 0) {
      throw new AppError(409, 'CONFLICT', 'Bàn đang có khách, không thể xóa.');
    }

    // Thực hiện xóa cascade toàn bộ lịch sử (Session, OrderItem, Payment) liên quan tới bàn này trong transaction
    await prisma.$transaction(async (tx) => {
      // 1. Lấy tất cả session ids của bàn
      const allSessions = await tx.tableSession.findMany({
        where: { tableId: id },
        select: { id: true },
      });
      const sessionIds = allSessions.map((s) => s.id);

      if (sessionIds.length > 0) {
        // 2. Xóa các Payment liên quan đến các session của bàn này
        await tx.payment.deleteMany({
          where: { sessionId: { in: sessionIds } },
        });

        // 3. Xóa các OrderItem liên quan
        await tx.orderItem.deleteMany({
          where: { sessionId: { in: sessionIds } },
        });

        // 4. Xóa các TableSession liên quan
        await tx.tableSession.deleteMany({
          where: { tableId: id },
        });
      }

      // 5. Cuối cùng mới xóa Bàn
      await tx.table.delete({
        where: { id },
      });
    });

    return { success: true, message: 'Đã xóa bàn thành công.' };
  }
}
