import { Router } from 'express';
import { authMiddleware } from '../middlewares/auth.middleware';
import * as platformAdminController from '../controllers/platform-admin.controller';

const router = Router();

const requirePlatformAdmin = (req: any, res: any, next: any) => {
  if (req.user?.role !== 'PLATFORM_ADMIN') {
    return res.status(403).json({ success: false, message: 'Forbidden: Platform Admin only' });
  }
  next();
};

router.use(authMiddleware);
router.use(requirePlatformAdmin);

router.get('/tenants', platformAdminController.listTenants);
router.post('/tenants', platformAdminController.createTenant);
router.put('/tenants/:id', platformAdminController.updateTenant);
router.put('/tenants/:id/suspend', platformAdminController.suspendTenant);
router.put('/tenants/:id/activate', platformAdminController.activateTenant);
router.put('/tenants/:id/subscription', platformAdminController.updateTenantSubscription);
router.get('/audit-logs', platformAdminController.getAuditLogs);

export default router;
