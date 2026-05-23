import { Request, Response } from 'express';
import { z } from 'zod';
import * as svc from '../services/ingredient.service';

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
  reason: z.enum(['MANUAL_IMPORT', 'ADJUSTMENT']),
  note:   z.string().optional(),
});

const bomEntrySchema = z.object({
  ingredientId: z.string().min(1),
  quantity:     z.coerce.number().positive('Số lượng phải > 0'),
});

// ── Ingredient CRUD ──────────────────────────────────────────────

export const getIngredients = async (req: Request, res: Response): Promise<void> => {
  try {
    const lowStock = req.query.lowStock === 'true';
    const data = await svc.getAll(lowStock);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const createIngredient = async (req: Request, res: Response): Promise<void> => {
  try {
    const parsed = ingredientSchema.parse(req.body);
    const item = await svc.create(parsed);
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
    const parsed = ingredientSchema.parse(req.body);

    // Warn if unit changed and has BOM refs
    const existing = await svc.getById(req.params.id);
    const unitChanged = existing && existing.unit !== parsed.unit;
    const bomCount = unitChanged
      ? (await svc.getBom(req.params.id)).length   // any BOM using this ing?
      : 0;

    const item = await svc.update(req.params.id, parsed);
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
    await svc.remove(req.params.id);
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

export const adjustStock = async (req: Request, res: Response): Promise<void> => {
  try {
    const { delta, reason, note } = stockAdjSchema.parse(req.body);

    if (reason === 'MANUAL_IMPORT' && delta <= 0) {
      res.status(400).json({ success: false, message: 'MANUAL_IMPORT yêu cầu delta > 0' });
      return;
    }

    const result = await svc.adjustStock(
      req.params.id, delta, reason, req.user!.userId, note
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
    const data  = await svc.getLogs(page, limit, req.query.ingredientId as string, req.query.reason as string);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

// ── BOM ──────────────────────────────────────────────────────────

export const getBom = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await svc.getBom(req.params.menuItemId);
    res.json({ success: true, data });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};

export const addBomEntry = async (req: Request, res: Response): Promise<void> => {
  try {
    const { ingredientId, quantity } = bomEntrySchema.parse(req.body);
    const entry = await svc.addBomEntry(req.params.menuItemId, ingredientId, quantity);
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
    const { quantity } = z.object({ quantity: z.coerce.number().positive() }).parse(req.body);
    const entry = await svc.updateBomEntry(req.params.menuItemId, req.params.ingredientId, quantity);
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
    await svc.deleteBomEntry(req.params.menuItemId, req.params.ingredientId);
    res.json({ success: true, message: 'Đã xóa khỏi công thức' });
  } catch (e) {
    res.status(500).json({ success: false, message: 'Lỗi server' });
  }
};
