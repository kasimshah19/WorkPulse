import { Router } from 'express';
import express from 'express';
import Joi from 'joi';
import asyncHandler from '../utils/asyncHandler.js';
import validate from '../middleware/validate.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';
import {
  createTopupOrder,
  verifyPayment,
  razorpayWebhook,
  getMyOrders,
} from '../controllers/payments.controller.js';

const router = Router();

const topupOrderSchema = Joi.object({
  amountPaise: Joi.number().integer().min(10000).max(5000000).optional(),
  amountRupees: Joi.number().min(100).max(50000).optional(),
}).or('amountPaise', 'amountRupees');

const verifySchema = Joi.object({
  orderId: Joi.string().optional().allow(''),
  gatewayOrderId: Joi.string().optional().allow(''),
  paymentId: Joi.string().optional().allow(''),
  gatewayPaymentId: Joi.string().optional().allow(''),
  signature: Joi.string().optional().allow(''),
  gatewaySignature: Joi.string().optional().allow(''),
  paymentOrderId: Joi.string().optional().allow(''),
}).unknown(true);

// Public webhook route (mounted with raw body parser for HMAC verification)
router.post(
  '/razorpay/webhook',
  express.raw({ type: 'application/json' }),
  asyncHandler(razorpayWebhook)
);

// Authenticated contractor routes
router.use(auth);

router.post(
  '/topup-order',
  role('contractor'),
  validate(topupOrderSchema),
  asyncHandler(createTopupOrder)
);

router.post(
  '/verify',
  role('contractor'),
  validate(verifySchema),
  asyncHandler(verifyPayment)
);

router.get('/orders', asyncHandler(getMyOrders));

export default router;
