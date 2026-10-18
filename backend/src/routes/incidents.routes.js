import { Router } from 'express';
import { reportIncident, getIncident, updateIncident } from '../controllers/incidents.controller.js';

const router = Router();

router.post('/', reportIncident);
router.get('/:id', getIncident);
router.patch('/:id', updateIncident);

export default router;
