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

// GET /api/tables - Admin/Manager
router.get(
  '/', 
  authMiddleware as any, 
  requireRole(['ADMIN', 'MANAGER']) as any, 
  handleGetAllTables as any
);

// PATCH /api/tables/:id/status - Admin/Manager/Staff
router.patch(
  '/:id/status', 
  authMiddleware as any, 
  requireRole(['ADMIN', 'MANAGER', 'STAFF', 'KITCHEN']) as any, 
  handleUpdateTableStatus as any
);

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
  requireRole(['ADMIN']) as any,
  handleDeleteTable as any
);

export default router;
