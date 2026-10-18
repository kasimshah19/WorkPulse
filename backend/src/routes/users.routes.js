import { Router } from 'express';
import { getMe, updateMe } from '../controllers/users.controller.js';

const router = Router();

router.get('/me', getMe);
router.patch('/me', updateMe);

export default router;
