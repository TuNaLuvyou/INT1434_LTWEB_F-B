import { Router, Request, Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import prisma from '../../config/prisma';

const router = Router();

/**
 * GET /api/v1/orders - Danh sách đơn hàng / phiên phục vụ của tenant
 * Query params: ?status=OPEN|PAID|CANCELLED&branchId=...&page=1&limit=50
 */
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Missing tenant context' });
      return;
    }

    const { status, branchId, limit = '50', page = '1' } = req.query as Record<string, string>;

    const where: any = { tenantId };
    if (status) where.status = status;
    if (branchId) where.branchId = branchId;

    const take = Math.min(parseInt(limit, 10) || 50, 100);
    const skip = ((parseInt(page, 10) || 1) - 1) * take;

    const [sessions, total] = await Promise.all([
      prisma.tableSession.findMany({
        where,
        take,
        skip,
        orderBy: { openedAt: 'desc' },
        include: {
          table: true,
          payment: true,
          orderItems: {
            include: {
              menuItem: {
                select: {
                  id: true,
                  name: true,
                  price: true,
                },
              },
            },
          },
        },
      }),
      prisma.tableSession.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        sessions,
        pagination: {
          total,
          page: parseInt(page, 10) || 1,
          limit: take,
          totalPages: Math.ceil(total / take),
        },
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

/**
 * GET /api/v1/orders/:sessionId - Chi tiết 1 đơn hàng theo ID
 * Chỉ trả về session thuộc tenant của API key (chống IDOR cross-tenant).
 */
router.get('/:sessionId', async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthenticatedRequest;
    const tenantId = authReq.user?.tenantId;
    if (!tenantId) {
      res.status(403).json({ success: false, message: 'Missing tenant context' });
      return;
    }

    const { sessionId } = req.params as { sessionId: string };

    const session = await prisma.tableSession.findFirst({
      where: { id: sessionId, tenantId },
      include: {
        table: true,
        payment: true,
        orderItems: {
          include: {
            menuItem: {
              select: { id: true, name: true, price: true },
            },
          },
        },
      },
    });

    if (!session) {
      res.status(404).json({ success: false, message: 'Order not found' });
      return;
    }

    res.json({ success: true, data: session });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

export default router;
