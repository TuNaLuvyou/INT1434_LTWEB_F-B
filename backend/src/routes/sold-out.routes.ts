import { Router } from 'express';
import { updateSoldOut } from '../controllers/sold-out.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// PATCH /api/admin/menu-items/:id/sold-out
// Auth: ADMIN, MANAGER, KITCHEN (bếp được phép báo hết món)
router.patch(
  '/:id/sold-out',
  authMiddleware,
  requireRole(['ADMIN', 'MANAGER', 'KITCHEN']),
  updateSoldOut
);

export default router;
