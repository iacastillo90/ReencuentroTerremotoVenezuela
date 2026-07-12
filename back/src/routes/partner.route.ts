import { Router } from 'express';
import { requirePartnerApiKey } from '../middlewares/auth.middleware';
import { getPartnerCasesHandler, postPartnerCasesHandler } from '../controllers/partner.controller';

export const partnerRouter = Router();

partnerRouter.get('/cases', requirePartnerApiKey, getPartnerCasesHandler);
partnerRouter.post('/cases', requirePartnerApiKey, postPartnerCasesHandler);
