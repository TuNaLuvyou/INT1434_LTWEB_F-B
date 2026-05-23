import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';
import { emitTableStatusChanged } from '../socket/emit.helpers';

const router = Router();

// GET /api/tables
router.get('/', async (req: Request, res: Response) => {
  try {
    const tables = await prisma.table.findMany({
      orderBy: {
        tableNumber: 'asc',
      },
    });

    res.status(200).json({
      success: true,
      data: tables,
    });
  } catch (error) {
    console.error('[TableRoutes] Error fetching tables:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

// PATCH /api/tables/:id/status
router.patch('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status: 'AVAILABLE' | 'OCCUPIED' | 'RESERVED' };

    if (!['AVAILABLE', 'OCCUPIED', 'RESERVED'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Trạng thái không hợp lệ. Chỉ chấp nhận AVAILABLE, OCCUPIED, RESERVED.',
      });
    }

    const updatedTable = await prisma.table.update({
      where: { id },
      data: { status },
    });

    // Emit table status changed to listeners
    emitTableStatusChanged({
      tableId: updatedTable.id,
      status: updatedTable.status,
    });

    res.status(200).json({
      success: true,
      data: updatedTable,
    });
  } catch (error) {
    console.error('[TableRoutes] Error updating table status:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
  }
});

export default router;
