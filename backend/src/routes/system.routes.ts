import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { getConfig, updateConfig, syncMenu, cleanupHistory, getOverviewStats } from '../controllers/system.controller';

const router = Router();

router.use(authMiddleware);

router.get('/overview', getOverviewStats);
router.get('/config', requireRole(['ADMIN']), getConfig);
router.put('/config', requireRole(['ADMIN']), updateConfig);
router.post('/cleanup-history', requireRole(['ADMIN', 'MANAGER']), cleanupHistory);

export default router;
