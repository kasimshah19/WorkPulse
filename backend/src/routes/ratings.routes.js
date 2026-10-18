import { Router } from 'express';
import { submitRating, getUserRatings } from '../controllers/ratings.controller.js';

const router = Router();

router.post('/', submitRating);
router.get('/user/:id', getUserRatings);

export default router;
