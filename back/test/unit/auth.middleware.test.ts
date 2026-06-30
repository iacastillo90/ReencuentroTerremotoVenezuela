import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { requireUser, requireProfileComplete, requireWebhookApiKey } from '../../src/middlewares/auth.middleware';
import { UserModel } from '../../src/models/user.model';

jest.mock('jsonwebtoken');
jest.mock('../../src/models/user.model');

describe('Auth Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
      cookies: {},
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
    it('debería retornar 401 si no se provee el header de autorización', async () => {
      await requireUser(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized: Missing or invalid token' });
    });

    it('debería retornar 401 si el formato del token es inválido', async () => {
      mockReq.headers = { authorization: 'InvalidTokenFormat' };
      await requireUser(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('debería retornar 401 si el token falla la verificación', async () => {
      mockReq.headers = { authorization: 'Bearer invalid_token' };
      (jwt.verify as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await requireUser(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid token' });
    });

    it('debería inyectar el usuario en request y llamar a next si el token es válido', async () => {
      mockReq.headers = { authorization: 'Bearer valid_token' };
      const mockDecoded = { userId: '123', email: 'test@test.com', isProfileComplete: true, tokenVersion: 1 };
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);
      (UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ tokenVersion: 1 }),
      });

      await requireUser(mockReq as Request, mockRes as Response, mockNext);
      
      expect(jwt.verify).toHaveBeenCalled();
      expect((mockReq as any).user).toEqual(mockDecoded);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    it('debería retornar 401 si el tokenVersion no coincide', async () => {
      mockReq.headers = { authorization: 'Bearer old_token' };
      const mockDecoded = { userId: '123', email: 'test@test.com', tokenVersion: 1 };
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);
      (UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ tokenVersion: 2 }),
      });

      await requireUser(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token revoked. Please login again.' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debería aceptar token desde cookie cuando no hay header de autorización', async () => {
      mockReq.headers = {};
      mockReq.cookies = { token: 'cookie-jwt-token' };
      const mockDecoded = { userId: '123', email: 'test@test.com', isProfileComplete: true, tokenVersion: 1 };
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);
      (UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ tokenVersion: 1 }),
      });

      await requireUser(mockReq as Request, mockRes as Response, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith('cookie-jwt-token', expect.any(String));
      expect((mockReq as any).user).toEqual(mockDecoded);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('requireProfileComplete', () => {
    it('debería retornar 403 si el perfil del usuario está incompleto', async () => {
      mockReq.headers = { authorization: 'Bearer valid_token' };
      const mockDecoded = { userId: '123', email: 'test@test.com', isProfileComplete: false, tokenVersion: 1 };
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);
      (UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ tokenVersion: 1 }),
      });

      await requireProfileComplete(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Forbidden: Profile incomplete' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('debería llamar a next si el perfil está completo', async () => {
      mockReq.headers = { authorization: 'Bearer valid_token' };
      const mockDecoded = { userId: '123', email: 'test@test.com', isProfileComplete: true, tokenVersion: 1 };
      (jwt.verify as jest.Mock).mockReturnValue(mockDecoded);
      (UserModel.findById as jest.Mock).mockReturnValue({
        select: jest.fn().mockResolvedValue({ tokenVersion: 1 }),
      });

      await requireProfileComplete(mockReq as Request, mockRes as Response, mockNext);
      
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });

  describe('requireWebhookApiKey', () => {
    it('debería retornar 500 si WEBHOOK_API_KEY no está configurado', () => {
      delete process.env.WEBHOOK_API_KEY;
      requireWebhookApiKey(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Server configuration error' });
    });

    it('debería retornar 401 si la API key es incorrecta', () => {
      process.env.WEBHOOK_API_KEY = 'correct-key';
      mockReq.headers = { 'x-webhook-api-key': 'wrong-key' };
      requireWebhookApiKey(mockReq as Request, mockRes as Response, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Unauthorized: Invalid webhook API key' });
    });

    it('debería llamar a next si la API key es correcta', () => {
      process.env.WEBHOOK_API_KEY = 'correct-key';
      mockReq.headers = { 'x-webhook-api-key': 'correct-key' };
      requireWebhookApiKey(mockReq as Request, mockRes as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });
  });
});
