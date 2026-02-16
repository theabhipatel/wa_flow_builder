import { Router } from 'express';
import {
    createBot,
    getBots,
    getBot,
    updateBot,
    deleteBot,
    connectWhatsApp,
    checkWhatsAppConnection,
    disconnectWhatsApp,
} from '../controllers/botController';
import { getBotVariables, setBotVariable, deleteBotVariable } from '../controllers/botVariableController';
import { authenticate } from '../middlewares/authMiddleware';

const router = Router();

router.use(authenticate);

router.post('/', createBot);
router.get('/', getBots);
router.get('/:botId', getBot);
router.put('/:botId', updateBot);
router.delete('/:botId', deleteBot);

// WhatsApp
router.post('/:botId/whatsapp/connect', connectWhatsApp);
router.post('/:botId/whatsapp/check', checkWhatsAppConnection);
router.delete('/:botId/whatsapp/disconnect', disconnectWhatsApp);

// Bot variables
router.get('/:botId/variables', getBotVariables);
router.post('/:botId/variables', setBotVariable);
router.delete('/:botId/variables/:variableName', deleteBotVariable);

export default router;
