import { Router } from 'express';
import {
  getIngredients, createIngredient, updateIngredient,
  deleteIngredient, adjustStock, getLogs, reverseStock,
  getBom, addBomEntry, updateBomEntry, deleteBomEntry,
  getBranchStock, transferToBranch, getExportedStats,
} from '../controllers/ingredient.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

// ── adminRouter: ADMIN / MANAGER only ────────────────────────────
const adminRouter = Router();
adminRouter.use(authMiddleware, requireRole(['ADMIN', 'MANAGER']));

// ── Kho tổng & Kho chi nhánh ──────────────────────────────────────
adminRouter.get('/',           requireRole(['ADMIN', 'MANAGER']), getIngredients);
adminRouter.post('/',          requireRole(['ADMIN', 'MANAGER']), createIngredient);
adminRouter.put('/:id',        requireRole(['ADMIN', 'MANAGER']), updateIngredient);
adminRouter.delete('/:id',     requireRole(['ADMIN', 'MANAGER']), deleteIngredient);
// Nhập vào kho tổng / kho chi nhánh
adminRouter.patch('/:id/stock', requireRole(['ADMIN', 'MANAGER']), adjustStock);
// Xuất từ kho tổng sang kho chi nhánh: ADMIN only
adminRouter.post('/transfer-to-branch', requireRole(['ADMIN']), transferToBranch);

// ── Kho chi nhánh: ADMIN + Manager ──────────────────────────────
adminRouter.get('/branch-stock', getBranchStock);

// ── Đã xuất: ADMIN + Manager ─────────────────────────────────────
adminRouter.get('/exported-stats', getExportedStats);

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

