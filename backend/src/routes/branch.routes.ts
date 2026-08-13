import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import { listBranches, createBranch, updateBranch } from '../controllers/branch.controller';

const router = Router();

router.use(authMiddleware);
router.use(requireRole(['ADMIN', 'MANAGER']));

router.get('/', listBranches);
router.post('/', createBranch);
router.put('/:id', updateBranch);

export default router;
