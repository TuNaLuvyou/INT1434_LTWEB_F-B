import { Request, Response } from 'express';
import * as cashierService from '../services/cashier.service';

export async function getCashierOverview(req: Request, res: Response): Promise<void> {
  try {
    const tables = await cashierService.getCashierOverview();
    res.status(200).json({ success: true, data: { tables } });
  } catch (error: any) {
    console.error('getCashierOverview error:', error);
    res.status(500).json({ success: false, message: 'Lỗi server nội bộ' });
  }
}

export async function getCashierSessionItems(req: Request, res: Response): Promise<void> {
  try {
    const sessionId = req.params.sessionId as string;
    if (!sessionId) {
      res.status(400).json({ success: false, message: 'Thiếu sessionId' });
      return;
    }

    const data = await cashierService.getCashierSessionItems(sessionId);
    res.status(200).json({ success: true, data });
  } catch (error: any) {
    console.error('getCashierSessionItems error:', error);
    res.status(error?.statusCode || 500).json({
      success: false,
      message: error?.message || 'Lỗi server nội bộ',
    });
  }
}

export async function approveCashierSessionItems(req: Request, res: Response): Promise<void> {
  res.status(501).json({
    success: false,
    message: 'Implement in next commit',
  });
}
