import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { requireFeature } from '../middlewares/feature.guard';
import * as apiKeyController from '../controllers/apiKey.controller';

const router = Router();

router.use(authMiddleware);
router.use(requireFeature('API_ACCESS') as any);

router.post('/', requireRole(['ADMIN', 'MANAGER']), apiKeyController.createApiKey);
router.get('/', requireRole(['ADMIN', 'MANAGER']), apiKeyController.listApiKeys);
router.put('/:id', requireRole(['ADMIN', 'MANAGER']), apiKeyController.updateApiKey);
router.delete('/:id', requireRole(['ADMIN']), apiKeyController.revokeApiKey);

export default router;
