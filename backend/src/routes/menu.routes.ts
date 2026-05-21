import { Router } from 'express';
import { MenuController } from '../controllers/menu.controller';

const router = Router();

// GET /api/menu
router.get('/', MenuController.getMenu);

export default router;
