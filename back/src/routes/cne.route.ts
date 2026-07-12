import { Router } from 'express';
import { getCneIdentity } from '../controllers/cne.controller';

export const cneRouter = Router();

cneRouter.get('/:nationality/:cedula', getCneIdentity);
