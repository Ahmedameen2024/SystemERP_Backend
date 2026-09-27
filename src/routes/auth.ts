import { Router } from 'express';
import * as auth from '../controllers/authController';
import { authenticate } from '../middleware/auth';

const router = Router();

router.post('/login', auth.login);
router.post('/refresh', auth.refreshToken);
router.post('/logout', authenticate, auth.logout);
router.get('/profile', authenticate, auth.getProfile);

export default router;
