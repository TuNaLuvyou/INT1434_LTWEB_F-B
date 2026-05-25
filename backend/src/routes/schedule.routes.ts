import { Router } from 'express';
import { createSchedule, getSchedules, deleteSchedule } from '../controllers/schedule.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);

router.get('/', getSchedules);
router.post('/', requireRole(['ADMIN', 'MANAGER']), createSchedule);
router.delete('/:id', requireRole(['ADMIN', 'MANAGER']), deleteSchedule);

export default router;
