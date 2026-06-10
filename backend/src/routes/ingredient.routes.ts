import { Router } from 'express';
import {
  getIngredients, createIngredient, updateIngredient,
  deleteIngredient, adjustStock, getLogs, reverseStock,
  getBom, addBomEntry, updateBomEntry, deleteBomEntry,
} from '../controllers/ingredient.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

// ── adminRouter: ADMIN / MANAGER only ────────────────────────────
const adminRouter = Router();
adminRouter.use(authMiddleware, requireRole(['ADMIN', 'MANAGER']));

// ── Ingredients ──────────────────────────────────────────────────
adminRouter.get('/',           getIngredients);
adminRouter.post('/',          createIngredient);
adminRouter.put('/:id',        updateIngredient);
adminRouter.delete('/:id',     requireRole(['ADMIN']), deleteIngredient);
adminRouter.patch('/:id/stock', adjustStock);

// ── Inventory Logs ───────────────────────────────────────────────
adminRouter.get('/logs',       getLogs);

// ── BOM (sub-resource của MenuItem) ──────────────────────────────
adminRouter.get('/menu-items/:menuItemId/bom',                      getBom);
adminRouter.post('/menu-items/:menuItemId/bom',                     addBomEntry);
adminRouter.put('/menu-items/:menuItemId/bom/:ingredientId',        updateBomEntry);
adminRouter.delete('/menu-items/:menuItemId/bom/:ingredientId',     deleteBomEntry);

// ── reverseRouter: ADMIN / MANAGER / CASHIER ─────────────────────
// POST /api/inventory/reverse — Hoàn kho khi void OrderItem
const reverseRouter = Router();
reverseRouter.use(authMiddleware, requireRole(['ADMIN', 'MANAGER', 'CASHIER']));
reverseRouter.post('/reverse', reverseStock);

export { reverseRouter };
export default adminRouter;
