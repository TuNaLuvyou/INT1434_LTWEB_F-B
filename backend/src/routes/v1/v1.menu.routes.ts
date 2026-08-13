import { Router } from 'express';
import { getAdminMenuItems } from '../../controllers/admin.menu.controller';
import { getCategories } from '../../controllers/admin.category.controller';

const router = Router();

/**
 * GET /api/v1/menu/items - Lấy danh sách món ăn cho đối tác
 * GET /api/v1/menu/categories - Lấy danh sách danh mục món ăn
 */
router.get('/items', getAdminMenuItems as any);
router.get('/categories', getCategories as any);

export default router;
