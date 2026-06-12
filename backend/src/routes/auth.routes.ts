import { Router } from 'express';
import { register, login, refresh, logout, me } from '../controllers/auth.controller';
import { authMiddleware } from '../middlewares/auth.middleware';
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 phút
  max: 1000,                 // tối đa 1000 lần login
  message: { success: false, message: 'Quá nhiều lần thử. Vui lòng đợi 15 phút.' }
});

const router = Router();

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', authMiddleware, logout);
router.get('/me', authMiddleware, me);

export default router;
