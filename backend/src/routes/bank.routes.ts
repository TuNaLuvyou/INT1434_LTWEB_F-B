import { Router } from 'express';
import { authMiddleware, requireRole } from '../middlewares/auth.middleware';
import * as bankController from '../controllers/bank.controller';

const router = Router();

router.use(authMiddleware);
// Chỉ ADMIN (chủ tenant) mới được quản lý tài khoản ngân hàng
router.use(requireRole(['ADMIN']));

router.get('/', bankController.getBankAccounts);
router.post('/', bankController.createBankAccount);
router.put('/:id', bankController.updateBankAccount);
router.delete('/:id', bankController.deleteBankAccount);

export default router;
