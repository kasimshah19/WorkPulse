import { Router } from 'express';
import asyncHandler from '../utils/asyncHandler.js';
import auth from '../middleware/auth.js';
import Notification from '../models/Notification.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

const router = Router();

router.use(auth);

/**
 * GET /api/v1/notifications
 * Paginated notifications for current user.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page = 1, limit = 20, status } = req.query;
    const filter = { user: req.user._id };

    if (status) {
      filter.status = status;
    }

    const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
    const total = await Notification.countDocuments(filter);
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .lean();

    return sendSuccess(res, 200, notifications, {
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      total,
      totalPages: Math.ceil(total / limit),
    });
  })
);

/**
 * PATCH /api/v1/notifications/:id/read
 * Mark notification as read.
 */
router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { $set: { status: 'READ', readAt: new Date() } },
      { new: true }
    );

    if (!notification) {
      return sendError(res, 404, 'Notification not found', 'NOT_FOUND');
    }

    return sendSuccess(res, 200, notification);
  })
);

export default router;
