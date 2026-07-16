import { Request, Response } from 'express';
import { TableService } from '../services/table.service';
import { verifyAccessToken } from '../utils/jwt.utils';
import { emitTableStatusChanged } from '../socket/emit.helpers';
import { Role, TableStatus } from '@prisma/client';
import { checkUsageLimit } from '../services/usage-limit.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

/**
 * GET /api/tables
 * Trả về danh sách tất cả các bàn.
 * Nếu là Admin hoặc Manager (có header Authorization hợp lệ), include thông tin session.
 * Nếu là request ẩn danh (build-time generateStaticParams), chỉ trả về thông tin bàn cơ bản.
 */
export const handleGetAllTables = async (req: Request, res: Response) => {
  try {
    let isAdmin = false;
    let tenantId: string | undefined;
    let branchId: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      if (token) {
        try {
          const payload = verifyAccessToken(token);
          if (payload && (payload.role === Role.ADMIN || payload.role === Role.MANAGER)) {
            isAdmin = true;
            tenantId = payload.tenantId;
            branchId = payload.branchId;
          }
        } catch (err) {
          // Ignored: token hết hạn hoặc không hợp lệ, coi như người dùng public
        }
      }
    }

    const tables = await TableService.getAllTables(isAdmin, tenantId, branchId);
    res.status(200).json({
      success: true,
      data: tables,
    });
  } catch (error: any) {
    console.error('[TableController] Lỗi lấy danh sách bàn:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi server khi truy vấn danh sách bàn ăn',
    });
  }
};

/**
 * POST /api/tables
 * Tạo bàn mới. Chỉ cho phép ADMIN/MANAGER.
 */
export const handleCreateTable = async (req: Request, res: Response) => {
  try {
    const { tableNumber, label } = req.body;

    if (tableNumber === undefined || !label) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp đầy đủ số bàn (tableNumber) và tên bàn (label).',
      });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    // Default to a placeholder branch if not in token, ideally frontend passes it
    const branchId = authReq.user?.branchId || req.body.branchId; 

    if (!tenantId || !branchId) {
      return res.status(403).json({ success: false, message: 'Forbidden: Missing tenant/branch context' });
    }

    await checkUsageLimit(tenantId, 'TABLE');

    const newTable = await TableService.createTable(tenantId, branchId, Number(tableNumber), label);

    res.status(201).json({
      success: true,
      message: 'Tạo bàn ăn mới thành công.',
      data: newTable,
    });
  } catch (error: any) {
    console.error('[TableController] Lỗi tạo bàn mới:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi server khi lưu thông tin bàn ăn mới',
    });
  }
};

/**
 * PUT /api/tables/:id
 * Cập nhật thông tin bàn. Chỉ cho phép ADMIN/MANAGER.
 */
export const handleUpdateTable = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { label, status } = req.body as { label?: string; status?: TableStatus };

    if (req.body.tableNumber !== undefined) {
      res.status(400).json({
        success: false,
        message: 'Không được phép thay đổi số bàn để đảm bảo tính hợp lệ của mã QR.',
      });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const updatedTable = await TableService.updateTable(id, tenantId, label, status);

    // Nếu thay đổi trạng thái, phát tín hiệu Socket.io tới room "floor-plan"
    if (status) {
      emitTableStatusChanged({
        tableId: updatedTable.id,
        status: updatedTable.status as any,
        tableNumber: updatedTable.tableNumber,
        label: updatedTable.label,
      });
    }

    res.status(200).json({
      success: true,
      message: 'Cập nhật bàn ăn thành công.',
      data: updatedTable,
    });
  } catch (error: any) {
    console.error('[TableController] Lỗi cập nhật bàn:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi server khi cập nhật thông tin bàn ăn',
    });
  }
};

/**
 * DELETE /api/tables/:id
 * Xóa bàn ăn. Chỉ cho phép ADMIN/MANAGER.
 */
export const handleDeleteTable = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const result = await TableService.deleteTable(id, tenantId);

    res.status(200).json({
      success: true,
      message: result.message,
    });
  } catch (error: any) {
    console.error('[TableController] Lỗi xóa bàn:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi server khi xóa bàn ăn',
    });
  }
};

/**
 * PATCH /api/tables/:id/status
 * Cập nhật trạng thái bàn nhanh (phục vụ dashboard nội bộ không yêu cầu token)
 */
export const handleUpdateTableStatus = async (req: Request, res: Response) => {
  try {
    const id = req.params.id as string;
    const { status } = req.body as { status?: TableStatus };

    if (!status) {
      res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp trạng thái bàn ăn.',
      });
      return;
    }

    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const updatedTable = await TableService.updateTable(id, tenantId, undefined, status);

    // Phát tín hiệu Socket.io tới room "floor-plan"
    emitTableStatusChanged({
      tableId: updatedTable.id,
      status: updatedTable.status as any,
      tableNumber: updatedTable.tableNumber,
      label: updatedTable.label,
    });

    res.status(200).json({
      success: true,
      message: 'Cập nhật trạng thái bàn thành công.',
      data: updatedTable,
    });
  } catch (error: any) {
    console.error('[TableController] Lỗi cập nhật trạng thái bàn:', error);
    res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || 'Lỗi server khi cập nhật trạng thái bàn ăn',
    });
  }
};
