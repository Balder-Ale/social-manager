import express from 'express';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';
import crypto from 'crypto';
import { buildAuthUrl, exchangeCode } from './services/oauth';
import { getCached, setCache, buildTrendCacheKey } from '../utils/cache';

// Load env variables
dotenv.config();

const prisma = new PrismaClient();
const app = express();
const port = process.env.PORT || 4001;

// In-memory OpenRouter API key (can be set at runtime via Settings UI)
let runtimeOpenRouterKey: string | null = null;

// ─── Tenant middleware ───────────────────────────────────────────────
// Extract X-Tenant-Id from request header. Falls back to first tenant.
app.use(async (req: any, _res, next) => {
  const headerTenantId = req.headers['x-tenant-id'] as string | undefined;

  if (headerTenantId) {
    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({ where: { id: headerTenantId } });
    if (tenant) {
      req.currentTenantId = tenant.id;
      return next();
    }
  }

  // Fallback: first tenant in DB
  const firstTenant = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
  req.currentTenantId = firstTenant?.id || null;
  next();
});

// Helper: resolve the active OpenRouter key
function getOpenRouterKey(): string | null {
  return runtimeOpenRouterKey || process.env.OPENROUTER_API_KEY || null;
}

app.use(express.json());

// Health check endpoint (checks database connection)
app.get('/health', async (req, res) => {
  try {
    // Check DB connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      service: 'social-manager-backend',
      database: 'connected'
    });
  } catch (error: any) {
    console.error('Database connection error in health check:', error);
    res.status(500).json({
      status: 'error',
      service: 'social-manager-backend',
      database: 'disconnected',
      error: error.message || error
    });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'Social-Manager Backend is running' });
});

// GET /api/tenants
// Lists all tenants (for tenant switcher)
app.get('/api/tenants', async (req: any, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      select: { id: true, name: true, createdAt: true },
      orderBy: { createdAt: 'asc' }
    });
    return res.json(tenants);
  } catch (error: any) {
    console.error('Error in GET /api/tenants:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /api/tenants
// Creates a new tenant
app.post('/api/tenants', async (req, res) => {
  const { name } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Missing required field: name' });
  }
  try {
    const tenant = await prisma.tenant.create({ data: { name } });
    console.log(`[Tenants API] Created tenant: ${tenant.name} (${tenant.id})`);
    return res.status(201).json(tenant);
  } catch (error: any) {
    console.error('Error in POST /api/tenants:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// DELETE /api/tenants/:id
// Deletes a tenant (and its brands, accounts)
app.delete('/api/tenants/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await prisma.tenant.delete({ where: { id } });
    return res.json({ status: 'ok' });
  } catch (error: any) {
    console.error('Error in DELETE /api/tenants:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// GET /api/brands
// Lists all brands for the current tenant
app.get('/api/brands', async (req: any, res) => {
  try {
    const where = req.currentTenantId ? { tenantId: req.currentTenantId } : {};
    const brands = await prisma.brand.findMany({
      where,
      select: {
        id: true,
        name: true,
        tone: true,
        guidelines: true,
        createdAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    return res.json(brands);
  } catch (error: any) {
    console.error('Error in GET /api/brands:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /api/brands
// Creates a new brand entry for the current tenant
app.post('/api/brands', async (req: any, res) => {
  const { name, tone, palette, guidelines, logoUrl } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Missing required field: name' });
  }

  try {
    let tenantId = req.currentTenantId;
    if (!tenantId) {
      const firstTenant = await prisma.tenant.findFirst({ orderBy: { createdAt: 'asc' } });
      if (!firstTenant) {
        return res.status(400).json({ error: 'No tenant found. Create a tenant first.' });
      }
      tenantId = firstTenant.id;
    }

    const brand = await prisma.brand.create({
      data: {
        name,
        tone: tone || null,
        paletteJson: Array.isArray(palette) ? palette : null,
        guidelines: guidelines || null,
        logoUrl: logoUrl || null,
        tenant: { connect: { id: tenantId } }
      }
    });

    console.log(`[Brands API] Created brand: ${brand.name} (${brand.id})`);
    return res.status(201).json(brand);
  } catch (error: any) {
    console.error('Error in /api/brands:', error);
    return res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// POST /api/analyze/trends
// Generates trends and hooks using OpenRouter LLM
app.post('/api/analyze/trends', async (req, res) => {
  const { brandId, topic } = req.body;

  if (!brandId) {
    return res.status(400).json({ error: 'Missing brandId' });
  }

  try {
    // Fetch brand from DB
    const brand = await prisma.brand.findUnique({
      where: { id: brandId }
    });

    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    const brandName = brand.name;
    const tone = brand.tone || 'friendly';
    const guidelines = brand.guidelines || '';

    console.log(`[Trends API] Analyzing trends for brand "${brandName}" on topic "${topic || 'General'}"`);

    // ── Cache check (stale-while-revalidate) ────────────────────────
    const cacheKey = buildTrendCacheKey(brandId, topic);
    const cached = await getCached<any>(cacheKey);

    if (cached.data && !cached.stale) {
      console.log('[Trends API] Returning cached response');
      return res.json({ ...cached.data, source: cached.data.source || 'cache' });
    }

    // Stale: serve stale + revalidate in background
    if (cached.data && cached.stale) {
      console.log('[Trends API] Serving stale cache, revalidating in background');
      // Fire-and-forget revalidate, response returns stale data immediately
      revalidateTrends(cacheKey, brandName, tone, guidelines, topic, getOpenRouterKey())
        .then((fresh) => { if (fresh) setCache(cacheKey, fresh); })
        .catch(() => {});
      return res.json({ ...cached.data, source: 'cache-stale' });
    }

    const openrouterApiKey = getOpenRouterKey();

    // Check if we have an OpenRouter API key
    if (!openrouterApiKey || openrouterApiKey.includes('YOUR_OPENROUTER_API_KEY')) {
      console.warn('[Trends API] OpenRouter API key not configured. Returning mock response.');
      const mockData = getMockTrends(brandName, tone, topic);
      await setCache(cacheKey, mockData).catch(() => {});
      return res.json(mockData);
    }

    // Call OpenRouter
    try {
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: 'nvidia/nemotron-3-super:free',
          messages: [
            {
              role: 'system',
              content: `You are an expert AI social media strategist. Analyze trends for the brand "${brandName}" with a tone of "${tone}". Brand guidelines: ${guidelines}`
            },
            {
              role: 'user',
              content: `Suggest 3 viral trends and 3 hook variations for a social media post about: "${topic || 'current digital marketing trends'}". Output the response as a valid JSON object with the keys "trends" (array of strings) and "hooks" (array of strings). Do not include any markdown format tags like \`\`\`json or explanation before or after. Output pure JSON only.`
            }
          ]
        },
        {
          headers: {
            Authorization: `Bearer ${openrouterApiKey}`,
            'Content-Type': 'application/json'
          },
          timeout: 30000 // 30s timeout
        }
      );

      const responseText = response.data.choices[0].message.content.trim();
      console.log('[Trends API] LLM Response:', responseText);

      // Clean response text in case LLM wrapped it in markdown
      let cleanJson = responseText;
      if (cleanJson.startsWith('```json')) {
        cleanJson = cleanJson.substring(7);
      }
      if (cleanJson.startsWith('```')) {
        cleanJson = cleanJson.substring(3);
      }
      if (cleanJson.endsWith('```')) {
        cleanJson = cleanJson.substring(0, cleanJson.length - 3);
      }
      cleanJson = cleanJson.trim();

      const result = JSON.parse(cleanJson);
      const responseData = {
        brandId,
        topic,
        trends: result.trends || [],
        hooks: result.hooks || [],
        source: 'openrouter'
      };

      // Store in cache (non-blocking)
      setCache(cacheKey, responseData).catch(() => {});

      return res.json(responseData);

    } catch (llmError: any) {
      console.error('[Trends API] OpenRouter call failed, falling back to mock:', llmError.message || llmError);
      const mockData = getMockTrends(brandName, tone, topic);
      await setCache(cacheKey, mockData).catch(() => {});
      return res.json(mockData);
    }

  } catch (error: any) {
    console.error('Error in /api/analyze/trends:', error);
    res.status(500).json({ error: 'Internal server error', details: error.message });
  }
});

// ─── Settings: OpenRouter API Key ────────────────────────────────────────────

// POST /api/settings/openrouter-key
// Stores the OpenRouter API key in memory for the current server session
app.post('/api/settings/openrouter-key', async (req, res) => {
  const { apiKey } = req.body;

  if (!apiKey || typeof apiKey !== 'string' || apiKey.trim().length === 0) {
    return res.status(400).json({ error: 'Missing or invalid apiKey' });
  }

  runtimeOpenRouterKey = apiKey.trim();
  console.log('[Settings] OpenRouter API key updated via Settings UI');
  return res.json({ status: 'ok', configured: true });
});

// GET /api/settings/openrouter-key/status
// Returns whether an OpenRouter key is configured (never exposes the key itself)
app.get('/api/settings/openrouter-key/status', (req, res) => {
  const key = getOpenRouterKey();
  return res.json({
    configured: !!key,
    source: runtimeOpenRouterKey ? 'runtime' : (process.env.OPENROUTER_API_KEY ? 'env' : 'none')
  });
});

// POST /api/settings/openrouter-key/test
// Validates the key by making a minimal API call to OpenRouter
app.post('/api/settings/openrouter-key/test', async (req, res) => {
  const key = getOpenRouterKey();
  if (!key) {
    return res.status(400).json({ error: 'No API key configured', valid: false });
  }

  try {
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'nvidia/nemotron-3-super:free',
        messages: [
          { role: 'user', content: 'Respond with just the word: OK' }
        ],
        max_tokens: 10
      },
      {
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const reply = response.data?.choices?.[0]?.message?.content?.trim?.() || '';
    return res.json({ valid: true, response: reply });
  } catch (err: any) {
    const status = err.response?.status;
    const detail = err.response?.data?.error?.message || err.message;
    console.error('[Settings] Key validation failed:', status, detail);
    return res.json({ valid: false, error: detail, status });
  }
});

// ─── Social Account OAuth ────────────────────────────────────────────

// In-memory store for OAuth state values (keyed by state -> platform)
const oauthStates = new Map<string, string>();

// GET /api/auth/:platform/authorize
// Redirects the user to the platform's OAuth consent screen
app.get('/api/auth/:platform/authorize', (req, res) => {
  const { platform } = req.params;

  if (!['instagram', 'facebook', 'tiktok'].includes(platform)) {
    return res.status(400).json({ error: `Unsupported platform: ${platform}` });
  }

  const state = crypto.randomUUID();
  oauthStates.set(state, platform);

  // Expire state after 10 minutes
  setTimeout(() => oauthStates.delete(state), 10 * 60 * 1000);

  try {
    const url = buildAuthUrl(platform, state);
    console.log(`[OAuth] Redirecting to ${platform} authorize: ${url}`);
    return res.redirect(url);
  } catch (err: any) {
    console.error('[OAuth] Error building auth URL:', err);
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/:platform/callback
// Handles the OAuth callback: exchanges code for token, stores the account
app.get('/api/auth/:platform/callback', async (req, res) => {
  const { platform } = req.params;
  const { code, state, error: oauthError } = req.query;

  if (oauthError) {
    console.error(`[OAuth] ${platform} returned error:`, oauthError);
    return res.redirect(`http://localhost:3000/settings?oauth_error=${oauthError}`);
  }

  if (!code || typeof code !== 'string') {
    return res.status(400).json({ error: 'Missing authorization code' });
  }

  // Verify state (optional but recommended)
  if (state && typeof state === 'string') {
    const expectedPlatform = oauthStates.get(state);
    if (!expectedPlatform) {
      console.warn('[OAuth] Unknown or expired state');
      // Non-critical, continue
    }
    oauthStates.delete(state as string);
  }

  try {
    const tokenData = await exchangeCode(platform, code);

    // Use tenant from middleware
    const tenantId = (req as any).currentTenantId;
    let tenantRecord: any;
    if (tenantId) {
      tenantRecord = await prisma.tenant.findUnique({ where: { id: tenantId } });
    } else {
      tenantRecord = await prisma.tenant.findFirst();
    }
    if (!tenantRecord) {
      return res.status(400).json({ error: 'No tenant found' });
    }

    // Upsert the social account
    await prisma.socialAccount.upsert({
      where: {
        platform_accountId_tenantId: {
          platform,
          accountId: tokenData.accountId,
          tenantId: tenantRecord.id
        }
      },
      update: {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken || null,
        tokenExpiresAt: tokenData.expiresAt || null,
        accountName: tokenData.accountName,
        metadata: tokenData.metadata || undefined,
      },
      create: {
        platform,
        accountId: tokenData.accountId,
        accountName: tokenData.accountName,
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken || null,
        tokenExpiresAt: tokenData.expiresAt || null,
        metadata: tokenData.metadata || undefined,
        tenant: { connect: { id: tenantRecord.id } }
      }
    });

    console.log(`[OAuth] ${platform} account connected: ${tokenData.accountName} (${tokenData.accountId})`);

    // Redirect back to Settings UI with success
    return res.redirect(`http://localhost:3000/settings?oauth_success=${platform}`);
  } catch (err: any) {
    console.error(`[OAuth] ${platform} callback error:`, err);
    return res.redirect(`http://localhost:3000/settings?oauth_error=${encodeURIComponent(err.message)}`);
  }
});

// GET /api/auth/accounts
// Lists all connected social accounts for the current tenant
app.get('/api/auth/accounts', async (req: any, res) => {
  try {
    const tenantId = req.currentTenantId;
    let tenantRecord;
    if (tenantId) {
      tenantRecord = await prisma.tenant.findUnique({ where: { id: tenantId } });
    } else {
      tenantRecord = await prisma.tenant.findFirst();
    }
    if (!tenantRecord) {
      return res.json([]);
    }

    const accounts = await prisma.socialAccount.findMany({
      where: { tenantId: tenantRecord.id },
      select: {
        id: true,
        platform: true,
        accountName: true,
        accountId: true,
        tokenExpiresAt: true,
        metadata: true,
        createdAt: true,
        updatedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return res.json(accounts);
  } catch (err: any) {
    console.error('[OAuth] Error listing accounts:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// ─── Growth Playbook ────────────────────────────────────────────────

// POST /api/analyze/playbook
// Generates a growth playbook using OpenRouter (strategist agent)
app.post('/api/analyze/playbook', async (req: any, res) => {
  const { brandId, industry } = req.body;

  if (!brandId) {
    return res.status(400).json({ error: 'Missing brandId' });
  }

  try {
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) {
      return res.status(404).json({ error: 'Brand not found' });
    }

    const brandName = brand.name;
    const tone = brand.tone || 'friendly';
    const activeIndustry = industry || 'social media';

    const apiKey = getOpenRouterKey();

    if (!apiKey || apiKey.includes('YOUR_OPENROUTER_API_KEY')) {
      // Return mock playbook
      return res.json({
        brand: brandName,
        industry: activeIndustry,
        executiveSummary: `Growth strategy for ${brandName} in the ${activeIndustry} space.`,
        weeklySchedule: [
          { day: 'Monday', type: 'Educational', content: `Share industry tips related to ${activeIndustry}` },
          { day: 'Wednesday', type: 'Engagement', content: 'Polls, Q&A, user-generated content' },
          { day: 'Friday', type: 'Promotional', content: `Highlight ${brandName} products/services` }
        ],
        tacticalTips: [
          `Use ${tone} tone across all platforms for consistency`,
          'Post at peak engagement times: 9am-11am and 6pm-8pm',
          'Repurpose top-performing content into different formats'
        ],
        kpi: ['Follower growth +15%', 'Engagement rate >3%', 'Post reach +25%'],
        source: 'mock'
      });
    }

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'meta-llama/llama-3-8b-instruct:free',
        messages: [
          {
            role: 'system',
            content: 'You are a growth strategist. Produce concise, actionable playbooks for social media brands.'
          },
          {
            role: 'user',
            content: `Create a growth playbook for the brand "${brandName}" (tone: ${tone}) in the ${activeIndustry} industry. Output valid JSON with keys: "executiveSummary" (string), "weeklySchedule" (array of {day, type, content}), "tacticalTips" (array of strings), "kpi" (array of strings). No markdown.`
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 30000
      }
    );

    let responseText = response.data.choices[0].message.content.trim();
    if (responseText.startsWith('```json')) responseText = responseText.substring(7);
    if (responseText.startsWith('```')) responseText = responseText.substring(3);
    if (responseText.endsWith('```')) responseText = responseText.substring(0, responseText.length - 3);

    const result = JSON.parse(responseText.trim());
    return res.json({
      brand: brandName,
      industry: activeIndustry,
      ...result,
      source: 'openrouter'
    });

  } catch (error: any) {
    console.error('[Playbook API] Error:', error);
    return res.status(500).json({ error: 'Failed to generate playbook', details: error.message });
  }
});

// GET /api/analyze/playbook/brands/:brandId
// Returns the latest cached playbook or triggers generation
app.get('/api/analyze/playbook/brands/:brandId', async (req: any, res) => {
  const { brandId } = req.params;
  // Simple pass-through: triggers a new generation
  // In production, cache the playbook by brandId
  try {
    const brand = await prisma.brand.findUnique({ where: { id: brandId } });
    if (!brand) return res.status(404).json({ error: 'Brand not found' });

    // Forward to POST logic via internal request
    const axios = require('axios');
    const protocol = req.protocol;
    const host = req.get('host');
    const origin = `${protocol}://${host}`;
    const playbookRes = await axios.post(`${origin}/api/analyze/playbook`, { brandId });
    return res.json(playbookRes.data);
  } catch (error: any) {
    console.error('[Playbook API] GET error:', error);
    return res.status(500).json({ error: 'Failed to get playbook' });
  }
});

// DELETE /api/auth/accounts/:id
// Disconnects (deletes) a social account
app.delete('/api/auth/accounts/:id', async (req, res) => {
  const { id } = req.params;

  try {
    await prisma.socialAccount.delete({ where: { id } });
    console.log(`[OAuth] Deleted social account: ${id}`);
    return res.json({ status: 'ok' });
  } catch (err: any) {
    console.error('[OAuth] Error deleting account:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/auth/mock-toggle
// Returns the current MOCK_SOCIAL setting
app.get('/api/auth/mock-toggle', (req, res) => {
  const mock = process.env.MOCK_SOCIAL !== 'false';
  return res.json({ mock });
});

// Helper for Mock Trends when OpenRouter fails or is not configured
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

/**
 * Background revalidation for stale cache entries.
 * Fetches fresh trends from OpenRouter and stores result in cache.
 */
async function revalidateTrends(
  cacheKey: string,
  brandName: string,
  tone: string,
  guidelines: string,
  topic: string | undefined,
  apiKey: string | null
) {
  if (!apiKey || apiKey.includes('YOUR_OPENROUTER_API_KEY')) {
    return getMockTrends(brandName, tone, topic);
  }

  const response = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: 'nvidia/nemotron-3-super:free',
      messages: [
        {
          role: 'system',
          content: `You are an expert AI social media strategist. Analyze trends for the brand "${brandName}" with a tone of "${tone}". Brand guidelines: ${guidelines}`
        },
        {
          role: 'user',
          content: `Suggest 3 viral trends and 3 hook variations for a social media post about: "${topic || 'current digital marketing trends'}". Output the response as a valid JSON object with the keys "trends" (array of strings) and "hooks" (array of strings). Do not include any markdown format tags like \`\`\`json or explanation before or after. Output pure JSON only.`
        }
      ]
    },
    {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    }
  );

  let cleanJson = response.data.choices[0].message.content.trim();
  if (cleanJson.startsWith('```json')) cleanJson = cleanJson.substring(7);
  if (cleanJson.startsWith('```')) cleanJson = cleanJson.substring(3);
  if (cleanJson.endsWith('```')) cleanJson = cleanJson.substring(0, cleanJson.length - 3);
  cleanJson = cleanJson.trim();

  const result = JSON.parse(cleanJson);
  return {
    brandId: cacheKey,
    topic,
    trends: result.trends || [],
    hooks: result.hooks || [],
    source: 'openrouter'
  };
}

app.listen(port, () => {
  console.log(`🚀 Social Manager Backend listening on port ${port}`);
});
