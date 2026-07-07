import request from 'supertest';
import express from 'express';
import { AppError, NotFoundError, ValidationError, AuthError, ForbiddenError, errorHandler } from '../middlewares/error.middleware';

function createTestApp(routeHandler: (req: any, res: any, next: any) => void, env?: string) {
  const app = express();
  if (env) process.env.NODE_ENV = env;
  app.get('/test', routeHandler);
  app.use(errorHandler);
  return app;
}

describe('AppError class hierarchy', () => {
  it('creates AppError with statusCode and message', () => {
    const error = new AppError(400, 'Bad request');
    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Bad request');
    expect(error.name).toBe('AppError');
  });

  it('creates AppError with optional details', () => {
    const error = new AppError(422, 'Validation failed', { field: 'email' });
    expect(error.details).toEqual({ field: 'email' });
  });

  it('creates NotFoundError with 404 status', () => {
    const error = new NotFoundError('Person not found');
    expect(error).toBeInstanceOf(AppError);
    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Person not found');
  });

  it('creates ValidationError with 400 status', () => {
    const error = new ValidationError('Invalid input');
    expect(error.statusCode).toBe(400);
  });

  it('creates AuthError with 401 status', () => {
    const error = new AuthError('Invalid token');
    expect(error.statusCode).toBe(401);
  });

  it('creates ForbiddenError with 403 status', () => {
    const error = new ForbiddenError('Insufficient permissions');
    expect(error.statusCode).toBe(403);
  });
});

describe('errorHandler middleware', () => {
  it('returns 404 JSON for NotFoundError', async () => {
    const app = createTestApp((req, res, next) => {
      next(new NotFoundError('Person not found'));
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(404);
    expect(res.body).toMatchObject({ error: 'Person not found' });
  });

  it('returns 500 for plain Error', async () => {
    const app = createTestApp((req, res, next) => {
      next(new Error('Something broke'));
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(500);
    expect(res.body).toMatchObject({ error: 'Error interno del servidor' });
  });

  it('includes stack trace in non-production', async () => {
    const app = createTestApp((req, res, next) => {
      next(new AppError(400, 'test'));
    }, 'development');
    const res = await request(app).get('/test');
    expect(res.body.stack).toBeDefined();
  });

  it('omits stack trace in production', async () => {
    const app = createTestApp((req, res, next) => {
      next(new AppError(400, 'test'));
    }, 'production');
    const res = await request(app).get('/test');
    expect(res.body.stack).toBeUndefined();
  });

  it('includes details for ValidationError', async () => {
    const app = createTestApp((req, res, next) => {
      next(new ValidationError('Invalid input', { field: 'name' }));
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(400);
    expect(res.body.details).toEqual({ field: 'name' });
    expect(res.body.error).toBe('Invalid input');
  });

  it('catches async thrown errors in Express 5', async () => {
    const app = createTestApp(async (req, res, next) => {
      throw new NotFoundError('Async error');
    });
    const res = await request(app).get('/test');
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('Async error');
  });
});
