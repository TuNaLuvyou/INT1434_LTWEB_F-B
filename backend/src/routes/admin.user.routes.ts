import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import {
  getUsers,
  createUser,
  updateUser,
  resetPassword,
  deleteUser
} from '../controllers/admin.user.controller';

const router = Router();

router.use(authMiddleware, requireRole(['ADMIN']));

router.get('/', getUsers);
router.post('/', createUser);
router.patch('/:id', updateUser);
router.post('/:id/reset-password', resetPassword);
router.delete('/:id', deleteUser);

export default router;
