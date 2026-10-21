import { Router } from 'express';
import auth from '../middleware/auth.js';
import {
  submitRating,
  getPending,
  getGivenRatings,
  getReceivedRatings,
  reportRatingHandler,
} from '../controllers/ratings.controller.js';

const router = Router();

// All rating endpoints require authenticated user
router.use(auth);

router.post('/', submitRating);
router.get('/pending', getPending);
router.get('/mine/given', getGivenRatings);
router.get('/received', getReceivedRatings);
router.post('/:id/report', reportRatingHandler);

export default router;
