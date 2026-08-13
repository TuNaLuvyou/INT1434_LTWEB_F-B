import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import * as webhookController from '../controllers/webhook.controller';

const router = Router();

router.use(authMiddleware);

router.post('/', requireRole(['ADMIN']), webhookController.createWebhook);
router.get('/', requireRole(['ADMIN', 'MANAGER']), webhookController.listWebhooks);
router.put('/:id', requireRole(['ADMIN']), webhookController.updateWebhook);
router.delete('/:id', requireRole(['ADMIN']), webhookController.deleteWebhook);
router.post('/:id/test', requireRole(['ADMIN']), webhookController.testWebhook);
router.get('/:id/deliveries', requireRole(['ADMIN', 'MANAGER']), webhookController.listDeliveries);
router.post('/deliveries/:id/retry', requireRole(['ADMIN']), webhookController.retryDelivery);

export default router;
