import { Router } from 'express';
import { verifyWebhook, handleWebhook } from '../controllers/webhookController';
import { webhookLimiter } from '../middlewares/rateLimiter';

const router = Router();

router.get('/whatsapp/:botId', verifyWebhook);
router.post('/whatsapp/:botId', webhookLimiter, handleWebhook);

export default router;
