import { Router, Request, Response } from 'express';
import prisma from '../config/prisma';

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

export default router;
