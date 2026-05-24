import { Router } from 'express';
import { getDevices, registerDevice, revokeDevice } from '../controllers/device.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['ADMIN']));

router.get('/', getDevices);
router.post('/register', registerDevice);
router.delete('/:id', revokeDevice);

export default router;
