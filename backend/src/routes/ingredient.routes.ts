import { Router } from 'express';
import {
  getIngredients, createIngredient, updateIngredient,
  deleteIngredient, adjustStock, getLogs,
  getBom, addBomEntry, updateBomEntry, deleteBomEntry,
} from '../controllers/ingredient.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Tất cả routes đều cần đăng nhập + quyền ADMIN/MANAGER
router.use(authMiddleware, requireRole(['ADMIN', 'MANAGER']));

// ── Ingredients ──────────────────────────────────────────────────
router.get('/',           getIngredients);
router.post('/',          createIngredient);
router.put('/:id',        updateIngredient);
router.delete('/:id',     deleteIngredient);
router.patch('/:id/stock', adjustStock);

// ── Inventory Logs ───────────────────────────────────────────────
router.get('/logs',       getLogs);

// ── BOM (sub-resource của MenuItem) ──────────────────────────────
router.get('/menu-items/:menuItemId/bom',                      getBom);
router.post('/menu-items/:menuItemId/bom',                     addBomEntry);
router.put('/menu-items/:menuItemId/bom/:ingredientId',        updateBomEntry);
router.delete('/menu-items/:menuItemId/bom/:ingredientId',     deleteBomEntry);

export default router;
