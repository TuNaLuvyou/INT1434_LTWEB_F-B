import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import {
  getMembershipTiers,
  createMembershipTier,
  updateMembershipTier,
  deleteMembershipTier,
} from '../controllers/membershipTier.controller';

const router = Router();

router.use(authMiddleware);

router.get('/', getMembershipTiers as any);
router.post('/', requireRole(['ADMIN']), createMembershipTier as any);
router.put('/:id', requireRole(['ADMIN']), updateMembershipTier as any);
router.delete('/:id', requireRole(['ADMIN']), deleteMembershipTier as any);

export default router;
