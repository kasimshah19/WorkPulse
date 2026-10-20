import { Router } from 'express';
import Joi from 'joi';
import asyncHandler from '../utils/asyncHandler.js';
import validate from '../middleware/validate.js';
import auth from '../middleware/auth.js';
import role from '../middleware/role.js';
import { SKILLS, LANGUAGE_PREFERENCE } from '../config/constants.js';
import {
  updateMe,
  updateLocation,
  updateAvailability,
  updateUPI,
} from '../controllers/users.controller.js';

const router = Router();

const updateMeSchema = Joi.object({
  name: Joi.string().min(2).max(100).optional(),
  skills: Joi.array().items(Joi.string().valid(...SKILLS)).optional(),
  languagePreference: Joi.string().valid(...Object.values(LANGUAGE_PREFERENCE)).optional(),
  experienceYears: Joi.number().min(0).max(50).optional(),
  address: Joi.string().max(300).optional().allow(''),
  upiId: Joi.string().max(100).optional().allow(''),
});

const updateUpiSchema = Joi.object({
  upiId: Joi.string().required(),
});

const updateLocationSchema = Joi.object({
  lat: Joi.number().min(-90).max(90).required(),
  lng: Joi.number().min(-180).max(180).required(),
});

const updateAvailabilitySchema = Joi.object({
  isAvailable: Joi.boolean().required(),
});

router.use(auth);

router.patch('/me', validate(updateMeSchema), asyncHandler(updateMe));
router.patch('/me/location', validate(updateLocationSchema), asyncHandler(updateLocation));
router.patch('/me/availability', role('worker'), validate(updateAvailabilitySchema), asyncHandler(updateAvailability));
router.patch('/me/upi', validate(updateUpiSchema), asyncHandler(updateUPI));

export default router;
