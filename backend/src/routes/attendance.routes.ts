import { Router } from 'express';
import { checkIn, checkOut, getToday, getHistory } from '../controllers/attendance.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { requireDeviceToken } from '../middlewares/device.middleware';

const router = Router();

router.post('/checkin', authMiddleware, requireDeviceToken, checkIn);
router.post('/checkout', authMiddleware, requireDeviceToken, checkOut);
router.get('/today', authMiddleware, getToday);
router.get('/history', authMiddleware, requireRole(['ADMIN', 'MANAGER']), getHistory);

export default router;
