import { Router } from 'express';
import Joi from 'joi';
import asyncHandler from '../utils/asyncHandler.js';
import validate from '../middleware/validate.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';
import {
  getMyWallet,
  getMyLedger,
  getMySummary,
  withdrawFunds,
} from '../controllers/wallet.controller.js';

const router = Router();

const withdrawSchema = Joi.object({
  amountPaise: Joi.number().integer().min(10000).required(),
  idempotencyKey: Joi.string().required(),
});

router.use(auth);

router.get('/', asyncHandler(getMyWallet));
router.get('/me', asyncHandler(getMyWallet));
router.get('/ledger', asyncHandler(getMyLedger));
router.get('/summary', asyncHandler(getMySummary));
router.post('/withdraw', role('worker'), validate(withdrawSchema), asyncHandler(withdrawFunds));

export default router;
