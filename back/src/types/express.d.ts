import { Request } from 'express';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email?: string;
        role?: string;
        status?: string;
        tokenVersion?: number;
        isProfileComplete?: boolean;
      };
    }
  }
}

export type AuthenticatedRequest = Request & {
  user: NonNullable<Request['user']>;
};
