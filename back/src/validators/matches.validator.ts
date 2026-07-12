import { z } from 'zod';
import { safeIdString } from '../utils/sanitize.util';

export const reportIdParamSchema = z.object({
  reportId: safeIdString.pipe(z.string().min(1, 'reportId es requerido'))
});
