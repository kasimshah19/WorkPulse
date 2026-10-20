import crypto from 'crypto';
import PaymentOrder from '../models/PaymentOrder.js';
import AuditLog from '../models/AuditLog.js';
import { getPaymentDriver, mockDriver, razorpayDriver } from '../services/payments/index.js';
import { getOrCreateWallet } from '../services/wallet.service.js';
import { postLedgerGroup } from '../services/ledger.service.js';
import {
  PAYMENT_ORDER_STATUS,
  LEDGER_ACCOUNT,
  LEDGER_ENTRY_TYPE,
} from '../config/constants.js';
import env from '../config/env.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';
import logger from '../utils/logger.js';

/**
 * POST /api/v1/payments/topup-order
 * Contractor creates a wallet top-up order.
 */
export const createTopupOrder = async (req, res) => {
  let amountPaise = req.body.amountPaise;
  if (!amountPaise && req.body.amountRupees) {
    amountPaise = Math.round(Number(req.body.amountRupees) * 100);
  }

  if (
    !Number.isSafeInteger(amountPaise) ||
    amountPaise < env.minTopupPaise ||
    amountPaise > env.maxTopupPaise
  ) {
    return sendError(
      res,
      400,
      `Amount must be between ₹${env.minTopupPaise / 100} and ₹${env.maxTopupPaise / 100}`,
      'INVALID_AMOUNT'
    );
  }

  const driver = getPaymentDriver();
  const providerOrder = await driver.createOrder({
    amountPaise,
    receipt: `rcpt_${Date.now()}`,
    notes: {
      userId: req.user._id.toString(),
      userName: req.user.name,
    },
  });

  const paymentOrder = await PaymentOrder.create({
    user: req.user._id,
    purpose: 'WALLET_TOPUP',
    amountPaise,
    currency: 'INR',
    provider: providerOrder.provider,
    providerOrderId: providerOrder.providerOrderId,
    status: PAYMENT_ORDER_STATUS.CREATED,
  });

  return sendSuccess(res, 201, {
    orderId: providerOrder.providerOrderId,
    gatewayOrderId: providerOrder.providerOrderId,
    amountPaise,
    keyId: providerOrder.keyId,
    provider: providerOrder.provider,
    paymentOrderId: paymentOrder._id.toString(),
    status: paymentOrder.status,
  });
};

/**
 * POST /api/v1/payments/verify
 * Verifies payment signature and credits contractor wallet.
 * Idempotent: safe against retries and webhooks.
 */
export const verifyPayment = async (req, res) => {
  const paymentOrderId = req.body.paymentOrderId;
  let orderId = req.body.orderId || req.body.gatewayOrderId;
  let paymentId = req.body.paymentId || req.body.gatewayPaymentId;
  let signature = req.body.signature || req.body.gatewaySignature;

  let paymentOrder;
  if (paymentOrderId) {
    paymentOrder = await PaymentOrder.findById(paymentOrderId);
  } else if (orderId) {
    paymentOrder = await PaymentOrder.findOne({ providerOrderId: orderId });
  }

  if (!paymentOrder) {
    return sendError(res, 404, 'Payment order not found.', 'ORDER_NOT_FOUND');
  }

  if (!orderId) {
    orderId = paymentOrder.providerOrderId;
  }

  if (!paymentId || !signature) {
    return sendError(res, 400, 'paymentId and signature are required.', 'INVALID_INPUT');
  }

  // Idempotent hit: already paid
  if (paymentOrder.status === PAYMENT_ORDER_STATUS.PAID || paymentOrder.status === 'SUCCESS') {
    const currentWallet = await getOrCreateWallet(paymentOrder.user);
    return sendSuccess(res, 200, {
      status: PAYMENT_ORDER_STATUS.SUCCESS,
      balancePaise: currentWallet.balancePaise,
      paymentOrder,
    });
  }

  // Choose driver that created this order
  const driver = paymentOrder.provider === 'razorpay' ? razorpayDriver : mockDriver;

  const isValid = driver.verifyPaymentSignature({
    orderId,
    paymentId,
    signature,
  });

  if (!isValid) {
    // Record security audit log
    await AuditLog.create({
      actor: req.user._id,
      action: 'PAYMENT_SIGNATURE_INVALID',
      entityType: 'PaymentOrder',
      entityId: paymentOrder._id.toString(),
      after: { orderId, paymentId, ip: req.ip },
    }).catch(() => {});

    return sendError(res, 400, 'Invalid payment signature. Payment cannot be verified.', 'INVALID_PAYMENT_SIGNATURE');
  }

  // Idempotent: credit wallet via postLedgerGroup
  const wallet = await getOrCreateWallet(paymentOrder.user);
  const ledgerGroupId = `TOPUP:${paymentId}`;

  await postLedgerGroup({
    groupId: ledgerGroupId,
    entries: [
      {
        account: LEDGER_ACCOUNT.GATEWAY_EXTERNAL,
        wallet: null,
        entryType: LEDGER_ENTRY_TYPE.DEBIT,
        amountPaise: paymentOrder.amountPaise,
        description: `External top-up via ${paymentOrder.provider} (Payment: ${paymentId})`,
        referenceType: 'PAYMENT_TOPUP',
        referenceId: paymentOrder._id.toString(),
      },
      {
        account: LEDGER_ACCOUNT.CONTRACTOR_WALLET,
        wallet: wallet._id,
        entryType: LEDGER_ENTRY_TYPE.CREDIT,
        amountPaise: paymentOrder.amountPaise,
        description: `Wallet top-up credited via ${paymentOrder.provider}`,
        referenceType: 'PAYMENT_TOPUP',
        referenceId: paymentOrder._id.toString(),
      },
    ],
  });

  paymentOrder.status = PAYMENT_ORDER_STATUS.PAID;
  paymentOrder.providerPaymentId = paymentId;
  paymentOrder.signatureVerified = true;
  paymentOrder.paidAt = new Date();
  paymentOrder.ledgerGroupId = ledgerGroupId;
  await paymentOrder.save();

  const updatedWallet = await getOrCreateWallet(paymentOrder.user);

  return sendSuccess(res, 200, {
    status: PAYMENT_ORDER_STATUS.SUCCESS,
    balancePaise: updatedWallet.balancePaise,
    paymentOrder,
    walletBalancePaise: updatedWallet.balancePaise,
  });
};

/**
 * POST /api/v1/payments/razorpay/webhook
 * Public webhook endpoint for asynchronous payment captures.
 */
export const razorpayWebhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body; // Buffer from express.raw()

  const driver = razorpayDriver;
  const isValid = driver.verifyWebhookSignature(rawBody, signature);

  if (!isValid) {
    logger.warn('[Webhook] Invalid Razorpay webhook signature');
    return res.status(400).json({ success: false, error: 'Invalid webhook signature' });
  }

  let eventPayload;
  try {
    eventPayload = JSON.parse(rawBody.toString('utf8'));
  } catch (err) {
    return res.status(400).json({ success: false, error: 'Invalid JSON payload' });
  }

  const eventType = eventPayload.event;
  if (eventType === 'payment.captured' || eventType === 'order.paid') {
    const paymentEntity = eventPayload.payload?.payment?.entity;
    const orderId = paymentEntity?.order_id;
    const paymentId = paymentEntity?.id;
    const amount = paymentEntity?.amount;

    if (orderId && paymentId) {
      const paymentOrder = await PaymentOrder.findOne({ providerOrderId: orderId });
      if (paymentOrder && paymentOrder.amountPaise === amount) {
        const wallet = await getOrCreateWallet(paymentOrder.user);
        const ledgerGroupId = `TOPUP:${paymentId}`;

        await postLedgerGroup({
          groupId: ledgerGroupId,
          entries: [
            {
              account: LEDGER_ACCOUNT.GATEWAY_EXTERNAL,
              wallet: null,
              entryType: LEDGER_ENTRY_TYPE.DEBIT,
              amountPaise: paymentOrder.amountPaise,
              description: `Webhook: external top-up (Payment: ${paymentId})`,
              referenceType: 'WEBHOOK_TOPUP',
              referenceId: paymentOrder._id.toString(),
            },
            {
              account: LEDGER_ACCOUNT.CONTRACTOR_WALLET,
              wallet: wallet._id,
              entryType: LEDGER_ENTRY_TYPE.CREDIT,
              amountPaise: paymentOrder.amountPaise,
              description: `Webhook: wallet top-up credited`,
              referenceType: 'WEBHOOK_TOPUP',
              referenceId: paymentOrder._id.toString(),
            },
          ],
        });

        paymentOrder.status = PAYMENT_ORDER_STATUS.PAID;
        paymentOrder.providerPaymentId = paymentId;
        paymentOrder.webhookReceivedAt = new Date();
        paymentOrder.paidAt = paymentOrder.paidAt || new Date();
        paymentOrder.ledgerGroupId = ledgerGroupId;
        await paymentOrder.save();
      }
    }
  }

  return res.status(200).json({ status: 'ok' });
};

/**
 * GET /api/v1/payments/orders
 * Returns user's own payment orders.
 */
export const getMyOrders = async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, Math.min(100, parseInt(limit, 10)));
  const skip = (pageNum - 1) * limitNum;

  const filter = { user: req.user._id };
  const total = await PaymentOrder.countDocuments(filter);
  const orders = await PaymentOrder.find(filter)
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limitNum)
    .lean();

  return sendSuccess(res, 200, orders, {
    page: pageNum,
    limit: limitNum,
    total,
    totalPages: Math.ceil(total / limitNum),
  });
};

/**
 * Dev Only: POST /api/v1/dev/wallet/topup
 * Instantly credits contractor wallet for local testing.
 */
export const devWalletTopup = async (req, res) => {
  if (!env.devAllowMockTopup || env.nodeEnv === 'production') {
    return sendError(res, 403, 'Dev mock top-up is disabled in production.', 'FORBIDDEN');
  }

  const { amountPaise = 500000 } = req.body;
  if (!Number.isSafeInteger(amountPaise) || amountPaise <= 0) {
    return sendError(res, 400, 'Invalid amountPaise', 'INVALID_AMOUNT');
  }

  const wallet = await getOrCreateWallet(req.user._id);
  const devId = crypto.randomUUID();
  const groupId = `TOPUP:dev-${devId}`;

  await postLedgerGroup({
    groupId,
    entries: [
      {
        account: LEDGER_ACCOUNT.GATEWAY_EXTERNAL,
        wallet: null,
        entryType: LEDGER_ENTRY_TYPE.DEBIT,
        amountPaise,
        description: `Dev direct top-up (${devId})`,
        referenceType: 'DEV_TOPUP',
        referenceId: devId,
      },
      {
        account: LEDGER_ACCOUNT.CONTRACTOR_WALLET,
        wallet: wallet._id,
        entryType: LEDGER_ENTRY_TYPE.CREDIT,
        amountPaise,
        description: `Dev mock top-up credited`,
        referenceType: 'DEV_TOPUP',
        referenceId: devId,
      },
    ],
  });

  const updatedWallet = await getOrCreateWallet(req.user._id);
  return sendSuccess(res, 200, {
    message: `Dev top-up of ₹${amountPaise / 100} applied successfully.`,
    balancePaise: updatedWallet.balancePaise,
    lockedPaise: updatedWallet.lockedPaise,
  });
};
