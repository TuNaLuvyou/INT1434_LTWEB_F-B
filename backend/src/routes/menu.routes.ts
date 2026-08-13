import { Router } from 'express';
import { MenuController } from '../controllers/menu.controller';
import { optionalApiKeyGuard } from '../middlewares/apiKey.guard';

const router = Router();

// GET /api/menu (Hỗ trợ cả X-API-Key và ?tenantId=...)
router.get('/', optionalApiKeyGuard, MenuController.getMenu);

export default router;
