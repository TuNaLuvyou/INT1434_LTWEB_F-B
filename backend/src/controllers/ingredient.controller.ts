import { Request, Response } from 'express';
import { z } from 'zod';
import * as svc from '../services/ingredient.service';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

// ── Schemas ──────────────────────────────────────────────────────

const UNITS = ['gram', 'ml', 'cái', 'kg', 'lít', 'chai', 'hộp'] as const;

const ingredientSchema = z.object({
  name:     z.string().min(1).max(100),
  unit:     z.enum(UNITS),
  stock:    z.coerce.number().min(0, 'Tồn kho không âm'),
  minStock: z.coerce.number().min(0, 'Ngưỡng cảnh báo không âm'),
});

const stockAdjSchema = z.object({
  delta:  z.number().refine(v => v !== 0, 'delta không được = 0'),
  reason: z.enum(['MANUAL_IMPORT', 'ADJUSTMENT', 'MANUAL_EXPORT']),
  note:   z.string().optional(),
});

const bomEntrySchema = z.object({
  ingredientId: z.string().min(1),
  quantity:     z.coerce.number().positive('Số lượng phải > 0'),
});

// ── Inventory Reverse (Void) ─────────────────────────────────────

/**
 * POST /api/inventory/reverse
 * Body: { orderItemId: string }
 *
 * Hoàn trả tồn kho nguyên liệu cho một OrderItem đã bị VOID.
 * Thường được gọi tự động bên trong voidOrderItem của cashier controller,
 * nhưng cũng có thể gọi trực tiếp (ví dụ: admin điều chỉnh thủ công).
 */
export const reverseStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { orderItemId } = z.object({ orderItemId: z.string().min(1) }).parse(req.body);
    const authReq = req as AuthenticatedRequest;
    const reversedBy = authReq.user?.userId;

    const reversed = await svc.reverseInventory(orderItemId, reversedBy, authReq.user?.tenantId, authReq.user?.branchId);

    res.json({
      success: true,
      message: `Đã hoàn kho ${reversed.length} nguyên liệu`,
      data: reversed,
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: e.issues });
    } else if (e?.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, message: e.message });
    } else if (e?.code === 'INVALID_STATUS') {
      res.status(409).json({ success: false, message: e.message });
    } else if (e?.code === 'ALREADY_REVERSED') {
      res.status(409).json({ success: false, message: e.message });
    } else {
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }
};

// ── Ingredient CRUD ──────────────────────────────────────────────

export const getIngredients = async (req: Request, res: Response): Promise<void> => {
  try {
    const lowStock = req.query.lowStock === 'true';
    const branchId = (req as any).user?.branchId || req.query.branchId as string | undefined;
    const data = await svc.getAll(lowStock, branchId);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const createIngredient = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = ingredientSchema.parse(req.body);
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    const branchId = authReq.user?.branchId;
    if (!tenantId) { res.status(403).json({ success: false, message: 'Forbidden' }); return; }
    const item = await svc.create(parsed, tenantId, branchId);
    res.status(201).json({ success: true, data: item });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: e.issues });
    } else {
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }
};

export const updateIngredient = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const parsed = ingredientSchema.parse(req.body);

    // Warn if unit changed and has BOM refs
    const existing = await svc.getById(id);
    const unitChanged = existing && existing.unit !== parsed.unit;
    const bomCount = unitChanged
      ? (await svc.getBom(id)).length   // any BOM using this ing?
      : 0;

    const item = await svc.update(id, parsed);
    res.json({
      success: true,
      data: item,
      ...(unitChanged && bomCount > 0 && {
        warning: `Bạn vừa đổi đơn vị — ${bomCount} công thức có thể bị ảnh hưởng.`,
      }),
    });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: e.issues });
    } else {
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }
};

export const deleteIngredient = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    await svc.remove(id);
    res.json({ success: true, message: 'Đã xóa nguyên liệu' });
  } catch (e: any) {
    if (e?.code === 'BOM_CONFLICT') {
      res.status(409).json({
        success: false,
        message: `Nguyên liệu đang dùng trong ${e.count} công thức. Xóa BOM trước.`,
      });
    } else {
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }
};

export const adjustStock = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const id = req.params.id as string;
    const { delta, reason, note } = stockAdjSchema.parse(req.body);

    if (reason === 'MANUAL_IMPORT' && delta <= 0) {
      res.status(400).json({ success: false, message: 'MANUAL_IMPORT yêu cầu delta > 0' });
      return;
    }
    if (reason === 'MANUAL_EXPORT' && delta >= 0) {
      res.status(400).json({ success: false, message: 'MANUAL_EXPORT yêu cầu delta < 0' });
      return;
    }

    const result = await svc.adjustStock(
      id, delta, reason as any, req.user!.userId, note, req.user!.tenantId, req.user!.branchId
    );
    res.json({ success: true, data: result });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: e.issues });
    } else if (e?.message === 'Ingredient not found') {
      res.status(404).json({ success: false, message: 'Không tìm thấy nguyên liệu' });
    } else {
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }
};

// ── Inventory Logs ───────────────────────────────────────────────

export const getLogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;
    const branchId = (req as any).user?.branchId || req.query.branchId as string | undefined;
    const data  = await svc.getLogs(page, limit, req.query.ingredientId as string, req.query.reason as string, branchId);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ── BOM ──────────────────────────────────────────────────────────

export const getBom = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItemId = req.params.menuItemId as string;
    const data = await svc.getBom(menuItemId);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const addBomEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItemId = req.params.menuItemId as string;
    const { ingredientId, quantity } = bomEntrySchema.parse(req.body);
    const entry = await svc.addBomEntry(menuItemId, ingredientId, quantity);
    res.status(201).json({ success: true, data: entry });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: e.issues });
    } else if (e?.code === 'NOT_FOUND') {
      res.status(404).json({ success: false, message: 'Nguyên liệu không tồn tại' });
    } else if (e?.code === 'P2002') {
      res.status(409).json({ success: false, message: 'Nguyên liệu này đã có trong công thức' });
    } else {
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }
};

export const updateBomEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItemId = req.params.menuItemId as string;
    const ingredientId = req.params.ingredientId as string;
    const { quantity } = z.object({ quantity: z.coerce.number().positive() }).parse(req.body);
    const entry = await svc.updateBomEntry(menuItemId, ingredientId, quantity);
    res.json({ success: true, data: entry });
  } catch (e: any) {
    if (e instanceof z.ZodError) {
      res.status(400).json({ success: false, errors: e.issues });
    } else {
      res.status(500).json({ success: false, message: 'Lỗi server' });
    }
  }
};

export const deleteBomEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const menuItemId = req.params.menuItemId as string;
    const ingredientId = req.params.ingredientId as string;
    await svc.deleteBomEntry(menuItemId, ingredientId);
    res.json({ success: true, message: 'Đã xóa khỏi công thức' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
