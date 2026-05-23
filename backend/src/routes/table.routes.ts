import { Router } from 'express';
import {
  handleGetAllTables,
  handleCreateTable,
  handleUpdateTable,
  handleDeleteTable,
  handleUpdateTableStatus
} from '../controllers/table.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// GET /api/tables - Public / Hybrid (Không bắt buộc token để phục vụ Next.js SSG build)
router.get('/', handleGetAllTables as any);

// PATCH /api/tables/:id/status - Public (Dành cho trang quản lý bàn nội bộ của staff không dùng token)
router.patch('/:id/status', handleUpdateTableStatus as any);

// Các thao tác thay đổi dữ liệu yêu cầu đăng nhập ADMIN hoặc MANAGER
router.post(
  '/',
  authMiddleware as any,
  requireRole(['ADMIN', 'MANAGER']) as any,
  handleCreateTable as any
);

router.put(
  '/:id',
  authMiddleware as any,
  requireRole(['ADMIN', 'MANAGER']) as any,
  handleUpdateTable as any
);

router.delete(
  '/:id',
  authMiddleware as any,
  requireRole(['ADMIN', 'MANAGER']) as any,
  handleDeleteTable as any
);

export default router;
