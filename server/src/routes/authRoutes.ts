import { Router } from 'express';
import { login, register, getMe, updateProfile, changePassword } from '../controllers/authController';
import { authenticate } from '../middlewares/authMiddleware';
import { authLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.post('/login', authLimiter, login);
router.post('/register', authLimiter, register);
router.get('/me', authenticate, getMe);
router.patch('/profile', authenticate, updateProfile);
router.put('/change-password', authenticate, changePassword);

export default router;
