import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { getConfig, updateConfig, syncMenu } from '../controllers/system.controller';

const router = Router();

router.use(authMiddleware);

router.get('/config', requireRole(['ADMIN']), getConfig);
router.put('/config', requireRole(['ADMIN']), updateConfig);

export default router;
