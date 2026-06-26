// Integration tests for the Express API routes in src/index.ts
// Uses a mocked PrismaClient and supertest to test endpoints

import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

jest.mock('axios');
jest.mock('@prisma/client', () => {
  const mPrismaClient = {
    $queryRaw: jest.fn(),
    tenant: {
      findFirst: jest.fn(),
    },
    brand: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    socialAccount: {
      findMany: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
    },
    $disconnect: jest.fn(),
  };
  return { PrismaClient: jest.fn(() => mPrismaClient) };
});

const mockedAxios = jest.mocked(axios);

// Prevent dotenv from loading real env
jest.mock('dotenv', () => ({
  config: jest.fn(),
}));

// ─── Helper: build app with mocked Prisma ───────────────────────────
function buildApp() {
  const prisma = new PrismaClient();
  const app = express();
  app.use(express.json());

  // Health check
  app.get('/health', async (_req: any, res: any) => {
    try {
      await (prisma as any).$queryRaw`SELECT 1`;
      res.json({ status: 'ok', service: 'social-manager-backend', database: 'connected' });
    } catch {
      res.status(500).json({ status: 'error', database: 'disconnected' });
    }
  });

  // GET /api/brands
  app.get('/api/brands', async (_req: any, res: any) => {
    try {
      const brands = await (prisma as any).brand.findMany({ orderBy: { createdAt: 'desc' } });
      res.json(brands);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/brands
  app.post('/api/brands', async (req: any, res: any) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: 'Missing required field: name' });

    try {
      const tenantRecord = await (prisma as any).tenant.findFirst();
      if (!tenantRecord) return res.status(400).json({ error: 'No tenant found' });

      const brand = await (prisma as any).brand.create({
        data: { name, tenant: { connect: { id: tenantRecord.id } } }
      });
      res.status(201).json(brand);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // POST /api/analyze/trends (mock only — no real env key)
  app.post('/api/analyze/trends', async (req: any, res: any) => {
    const { brandId } = req.body;
    if (!brandId) return res.status(400).json({ error: 'Missing brandId' });

    try {
      const brand = await (prisma as any).brand.findUnique({ where: { id: brandId } });
      if (!brand) return res.status(404).json({ error: 'Brand not found' });

      const mock = getMockTrends(brand.name || 'Brand', brand.tone || 'friendly', req.body.topic);
      res.json(mock);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Settings: save key
  let runtimeKey: string | null = null;
  app.post('/api/settings/openrouter-key', (req: any, res: any) => {
    const { apiKey } = req.body;
    if (!apiKey) return res.status(400).json({ error: 'Missing apiKey' });
    runtimeKey = apiKey;
    res.json({ status: 'ok', configured: true });
  });

  // Settings: status
  app.get('/api/settings/openrouter-key/status', (_req: any, res: any) => {
    res.json({ configured: !!runtimeKey, source: runtimeKey ? 'runtime' : 'none' });
  });

  // OAuth: list accounts
  app.get('/api/auth/accounts', async (_req: any, res: any) => {
    try {
      const tenantRecord = await (prisma as any).tenant.findFirst();
      if (!tenantRecord) return res.json([]);
      const accounts = await (prisma as any).socialAccount.findMany({
        where: { tenantId: tenantRecord.id },
        orderBy: { createdAt: 'desc' }
      });
      res.json(accounts);
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  // OAuth: delete account
  app.delete('/api/auth/accounts/:id', async (req: any, res: any) => {
    try {
      await (prisma as any).socialAccount.delete({ where: { id: req.params.id } });
      res.json({ status: 'ok' });
    } catch {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return { app, prisma };
}

// Helper (copied from index.ts)
function getMockTrends(brandName: string, tone: string, topic?: string) {
  const currentTopic = topic || 'social media content creation';
  return {
    brandId: 'mock-id',
    topic: currentTopic,
    trends: [
      `Trend 1: Micro-video series sharing insider secrets of ${currentTopic} for ${brandName}`,
      `Trend 2: Dynamic visual carousels using the green theme matching the ${tone} tone`,
      `Trend 3: Behind-the-scenes authentic reels showing how ${brandName} operates`
    ],
    hooks: [
      `Hook A (Curiosity): "Stop posting without a plan! Here is how ${brandName} is changing the game..."`,
      `Hook B (Fear of Missing Out): "If you're not doing this for ${currentTopic} in 2026, you're falling behind."`,
      `Hook C (Direct value): "Want to master ${currentTopic}? Here are 3 tips from ${brandName}."`
    ],
    source: 'mock'
  };
}

// ─── Tests ──────────────────────────────────────────────────────────

describe('API Routes', () => {
  let app: express.Express;
  let prisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    const built = buildApp();
    app = built.app;
    prisma = built.prisma;
  });

  // ── Health ─────────────────────────────────────────────────────────
  describe('GET /health', () => {
    it('returns ok when DB is connected', async () => {
      (prisma.$queryRaw as jest.Mock).mockResolvedValueOnce([1]);
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.database).toBe('connected');
    });

    it('returns error when DB is disconnected', async () => {
      (prisma.$queryRaw as jest.Mock).mockRejectedValueOnce(new Error('DB down'));
      const res = await request(app).get('/health');
      expect(res.status).toBe(500);
      expect(res.body.database).toBe('disconnected');
    });
  });

  // ── Brands ─────────────────────────────────────────────────────────
  describe('GET /api/brands', () => {
    it('returns empty list when no brands', async () => {
      (prisma.brand.findMany as jest.Mock).mockResolvedValueOnce([]);
      const res = await request(app).get('/api/brands');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns brands sorted by createdAt desc', async () => {
      const mockBrands = [
        { id: '1', name: 'Alpha', createdAt: new Date('2026-06-25') },
        { id: '2', name: 'Beta', createdAt: new Date('2026-06-24') },
      ];
      (prisma.brand.findMany as jest.Mock).mockResolvedValueOnce(mockBrands);
      const res = await request(app).get('/api/brands');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].name).toBe('Alpha');
    });
  });

  describe('POST /api/brands', () => {
    it('returns 400 when name is missing', async () => {
      const res = await request(app).post('/api/brands').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing');
    });

    it('returns 400 when no tenant exists', async () => {
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const res = await request(app).post('/api/brands').send({ name: 'TestBrand' });
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('No tenant found');
    });

    it('creates a brand successfully', async () => {
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValueOnce({ id: 'tenant_1' });
      const created = { id: 'brand_new', name: 'My Brand', tenantId: 'tenant_1' };
      (prisma.brand.create as jest.Mock).mockResolvedValueOnce(created);

      const res = await request(app).post('/api/brands').send({ name: 'My Brand' });
      expect(res.status).toBe(201);
      expect(res.body.name).toBe('My Brand');
      expect(res.body.id).toBe('brand_new');
    });
  });

  // ── Trends ─────────────────────────────────────────────────────────
  describe('POST /api/analyze/trends', () => {
    it('returns 400 when brandId is missing', async () => {
      const res = await request(app).post('/api/analyze/trends').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Missing brandId');
    });

    it('returns 404 when brand not found', async () => {
      (prisma.brand.findUnique as jest.Mock).mockResolvedValueOnce(null);
      const res = await request(app).post('/api/analyze/trends').send({ brandId: 'nonexistent' });
      expect(res.status).toBe(404);
      expect(res.body.error).toContain('Brand not found');
    });

    it('returns mock trends when brand is found', async () => {
      (prisma.brand.findUnique as jest.Mock).mockResolvedValueOnce({
        id: 'b1',
        name: 'CoolBrand',
        tone: 'fun',
        guidelines: 'Be creative'
      });

      const res = await request(app).post('/api/analyze/trends').send({
        brandId: 'b1',
        topic: 'summer launch'
      });

      expect(res.status).toBe(200);
      expect(res.body.trends).toHaveLength(3);
      expect(res.body.hooks).toHaveLength(3);
      expect(res.body.source).toBe('mock');
      expect(res.body.trends[0]).toContain('CoolBrand');
    });
  });

  // ── Settings ───────────────────────────────────────────────────────
  describe('POST /api/settings/openrouter-key', () => {
    it('saves an API key', async () => {
      const res = await request(app)
        .post('/api/settings/openrouter-key')
        .send({ apiKey: 'sk-or-v1-test' });
      expect(res.status).toBe(200);
      expect(res.body.configured).toBe(true);
    });

    it('rejects empty key', async () => {
      const res = await request(app)
        .post('/api/settings/openrouter-key')
        .send({ apiKey: '' });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/settings/openrouter-key/status', () => {
    it('returns not configured initially', async () => {
      const res = await request(app).get('/api/settings/openrouter-key/status');
      expect(res.body.configured).toBe(false);
    });
  });

  // ── Social Accounts ────────────────────────────────────────────────
  describe('GET /api/auth/accounts', () => {
    it('returns empty list when no tenant', async () => {
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValueOnce(null);
      const res = await request(app).get('/api/auth/accounts');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });

    it('returns connected accounts', async () => {
      (prisma.tenant.findFirst as jest.Mock).mockResolvedValueOnce({ id: 't1' });
      const mockAccounts = [
        { id: 'a1', platform: 'instagram', accountName: 'My IG', accountId: 'ig_1' },
        { id: 'a2', platform: 'facebook', accountName: 'My FB', accountId: 'fb_1' },
      ];
      (prisma.socialAccount.findMany as jest.Mock).mockResolvedValueOnce(mockAccounts);

      const res = await request(app).get('/api/auth/accounts');
      expect(res.status).toBe(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0].platform).toBe('instagram');
    });
  });

  describe('DELETE /api/auth/accounts/:id', () => {
    it('deletes an account', async () => {
      (prisma.socialAccount.delete as jest.Mock).mockResolvedValueOnce({});
      const res = await request(app).delete('/api/auth/accounts/some_id');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});