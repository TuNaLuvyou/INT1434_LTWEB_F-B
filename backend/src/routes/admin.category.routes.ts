import { Router } from 'express';
import { 
  getCategories, 
  createCategory, 
  updateCategory, 
  deleteCategory 
} from '../controllers/admin.category.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';

const router = Router();

// Tất cả các route này yêu cầu đăng nhập và có quyền ADMIN hoặc MANAGER
router.use(authMiddleware);
router.use(requireRole(['ADMIN', 'MANAGER']));

router.get('/', getCategories as any);
router.post('/', createCategory as any);
router.put('/:id', updateCategory as any);
router.delete('/:id', deleteCategory as any);

export default router;
