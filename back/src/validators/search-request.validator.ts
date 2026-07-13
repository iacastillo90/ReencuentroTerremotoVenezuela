import { z } from 'zod';

export const searchRequestStatusQuerySchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected', 'archived']).optional(),
});