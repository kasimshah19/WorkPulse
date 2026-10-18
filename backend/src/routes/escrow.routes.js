import { Router } from 'express';
import { fundEscrow, releaseEscrow, disputeEscrow, getEscrowStatus } from '../controllers/escrow.controller.js';

const router = Router();

router.post('/fund', fundEscrow);
router.post('/release/:txnId', releaseEscrow);
router.post('/dispute/:txnId', disputeEscrow);
router.get('/status/:txnId', getEscrowStatus);

export default router;
