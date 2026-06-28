import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireUser, requireProfileComplete } from '../../src/middlewares/auth.middleware';

jest.mock('jsonwebtoken');

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockNext = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('requireUser', () => {
    it('debería retornar 401 si no se provee el header de autorización', () => {
      requireUser(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized: Missing or invalid token' });
    });

    it('debería retornar 401 si el formato del token es inválido', () => {
      mockReq.headers = { authorization: 'InvalidTokenFormat' };
      requireUser(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('debería retornar 401 si el token falla la verificación', () => {
      mockReq.headers = { authorization: 'Bearer invalid_token' };
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      requireUser(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid token' });
    });

    it('debería inyectar el usuario en request y llamar a next si el token es válido', () => {
      mockReq.headers = { authorization: 'Bearer valid_token' };
      const mockDecoded = { userId: '123', email: 'test@test.com', isProfileComplete: true };
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      requireUser(mockReq as Request, mockRes as Response, mockNext);
      
      expect(jwt.verify).toHaveBeenCalled();
      expect((mockReq as any).user).toEqual(mockDecoded);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('requireProfileComplete', () => {
    it('debería retornar 403 si el perfil del usuario está incompleto', () => {
      mockReq.headers = { authorization: 'Bearer valid_token' };
      const mockDecoded = { userId: '123', email: 'test@test.com', isProfileComplete: false };
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      requireProfileComplete(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Forbidden: Profile incomplete' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debería llamar a next si el perfil está completo', () => {
      mockReq.headers = { authorization: 'Bearer valid_token' };
      const mockDecoded = { userId: '123', email: 'test@test.com', isProfileComplete: true };
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);

      requireProfileComplete(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });
});
