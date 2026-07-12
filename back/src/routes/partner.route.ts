import { Router } from 'express';
import { requirePartnerApiKey } from '../middlewares/auth.middleware';
import { getPartnerCases, postPartnerCases } from '../controllers/partner.controller';

export const partnerRouter = Router();

partnerRouter.get('/cases', requirePartnerApiKey, getPartnerCases);
partnerRouter.post('/cases', requirePartnerApiKey, postPartnerCases);
