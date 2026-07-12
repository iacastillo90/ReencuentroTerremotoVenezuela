import { Router } from 'express';
import { requirePartnerApiKey } from '../middlewares/auth.middleware';
import { getLocalizados, postLocalizados } from '../controllers/localizado.controller';

export const localizadoRouter = Router();

localizadoRouter.get('/', getLocalizados);
localizadoRouter.post('/', requirePartnerApiKey, postLocalizados);
