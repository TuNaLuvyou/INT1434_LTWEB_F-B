import { Router } from 'express';
import { 
  getAdminMenuItems, 
  createMenuItem, 
  updateMenuItem, 
  deleteMenuItem 
} from '../controllers/admin.menu.controller';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { upload } from '../middlewares/upload.middleware';

const router = Router();

// Tất cả các route này yêu cầu đăng nhập và có quyền ADMIN hoặc MANAGER
router.use(authMiddleware);
router.use(requireRole(['ADMIN', 'MANAGER']));

router.get('/', getAdminMenuItems);
router.post('/', upload.single('image'), createMenuItem);
router.put('/:id', upload.single('image'), updateMenuItem);
router.delete('/:id', deleteMenuItem);

export default router;
