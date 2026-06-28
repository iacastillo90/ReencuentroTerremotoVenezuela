import request from 'supertest';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import app from '../app';
import { UserModel } from '../models/user.model';
import { PersonModel } from '../models/unified-person.model';
import jwt from 'jsonwebtoken';

let mongoServer: MongoMemoryServer;
let adminToken: string;
let userToken: string;
let userId: string;

beforeAll(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  // Setup mock users
  const admin = await UserModel.create({
    email: 'admin@test.com',
    name: 'Admin Test',
    role: 'admin',
    isProfileComplete: true
  });
  
  const normalUser = await UserModel.create({
    email: 'user@test.com',
    name: 'User Test',
    role: 'user',
    isProfileComplete: true
  });

  userId = normalUser._id.toString();

  const JWT_SECRET = process.env.JWT_SECRET || 'secret';
  adminToken = jwt.sign({ userId: admin._id, email: admin.email, role: admin.role }, JWT_SECRET);
  userToken = jwt.sign({ userId: normalUser._id, email: normalUser.email, role: normalUser.role }, JWT_SECRET);

  // Setup mock person
  await PersonModel.create({
    idHash: 'person_123',
    name: 'John Doe',
    normalizedName: 'john doe',
    status: 'missing',
    lastSeen: {
      state: 'Caracas'
    }
  });
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongoServer.stop();
});

describe('API Routes Integration Tests', () => {

  describe('GET /health', () => {
    it('should return 200 OK', async () => {
      const res = await request(app).get('/health');
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('Auth & Verification Requests', () => {
    it('POST /api/auth/verification-request should allow users to request verification', async () => {
      const res = await request(app)
        .post('/api/auth/verification-request')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ notes: 'Soy periodista en Caracas' });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.user).toBe(userId);
      expect(res.body.notes).toBe('Soy periodista en Caracas');
    });
  });

  describe('Search Requests (Fase B)', () => {
    let requestId: string;

    it('POST /api/search-requests should create an alert', async () => {
      const res = await request(app)
        .post('/api/search-requests')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ searchName: 'Juan Perez', isMinor: false });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.searchName).toBe('Juan Perez');
      requestId = res.body._id;
    });

    it('GET /api/search-requests/mine should return alerts', async () => {
      const res = await request(app)
        .get('/api/search-requests/mine')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBeTruthy();
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('Case Contacts (Fase C)', () => {
    it('POST /api/contacts should send masked message', async () => {
      const res = await request(app)
        .post('/api/contacts')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ reportId: 'person_123', message: 'Tengo informacion valiosa' });
      
      expect(res.statusCode).toBe(201);
      expect(res.body.message).toBe('Tengo informacion valiosa');
      expect(res.body.reportId).toBe('person_123');
    });

    it('GET /api/contacts/sent should return sent messages', async () => {
      const res = await request(app)
        .get('/api/contacts/sent')
        .set('Authorization', `Bearer ${userToken}`);
      
      expect(res.statusCode).toBe(200);
      expect(res.body.length).toBeGreaterThan(0);
    });
  });

  describe('Admin Routes (Fase A & C)', () => {
    it('GET /api/admin/users should be blocked for normal users', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${userToken}`);
      expect(res.statusCode).toBe(403);
    });

    it('GET /api/admin/users should work for admins', async () => {
      const res = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(res.statusCode).toBe(200);
      expect(Array.isArray(res.body)).toBeTruthy();
    });

    it('PATCH /api/admin/persons/:idHash/status should log StateHistory', async () => {
      const res = await request(app)
        .patch('/api/admin/persons/person_123/status')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'found', notes: 'Encontrado sano y salvo' });
      
      expect(res.statusCode).toBe(200);
      expect(res.body.status).toBe('found');
    });
  });

});
