import { Router } from 'express';
import { getDevices, registerDevice, revokeDevice, getDeviceUsers } from '../controllers/device.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['ADMIN', 'MANAGER']));

router.get('/', getDevices);
router.get('/users', getDeviceUsers);
router.post('/register', registerDevice);
router.delete('/:id', revokeDevice);

export default router;
