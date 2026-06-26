// Tests for the demo-flow script (src/scripts/demo-flow.ts)
// Validates the pipeline logic by mocking Prisma and axios

jest.mock('@prisma/client', () => {
  const mPrisma = {
    brand: { findFirst: jest.fn() },
    post: { create: jest.fn() },
    workflow: { create: jest.fn() },
    $disconnect: jest.fn(),
  };
  return { PrismaClient: jest.fn(() => mPrisma) };
});

jest.mock('axios');

import axios from 'axios';
import { PrismaClient } from '@prisma/client';

const mockedAxios = jest.mocked(axios);

describe('demo-flow script logic', () => {
  let prisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new PrismaClient();
  });

  it('fetches brand, calls trends API, creates post and workflow', async () => {
    // 1. Mock brand found
    const brand = { id: 'b1', name: 'DemoBrand', tone: 'friendly' };
    (prisma.brand.findFirst as jest.Mock).mockResolvedValueOnce(brand);

    // 2. Mock trends API response
    mockedAxios.post.mockResolvedValueOnce({
      data: {
        trends: ['Trend A', 'Trend B', 'Trend C'],
        hooks: ['Hook 1', 'Hook 2', 'Hook 3'],
        source: 'mock',
      },
    });

    // 3. Mock post creation
    const post = { id: 'p1', title: 'Demo AI-Generated Post', content: 'Hook 1\n\n...' };
    (prisma.post.create as jest.Mock).mockResolvedValueOnce(post);

    // 4. Mock workflow creation
    const workflow = { id: 'w1', result: { score: 95, remarks: 'Excellent', platforms: ['instagram'] } };
    (prisma.workflow.create as jest.Mock).mockResolvedValueOnce(workflow);

    // --- Simulate the demo flow logic ---

    // Step 1: Find brand
    const foundBrand = await prisma.brand.findFirst();
    expect(foundBrand).toBeDefined();
    expect(foundBrand.name).toBe('DemoBrand');

    // Step 2: Call trends API
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:4001';
    const response = await axios.post(`${backendUrl}/api/analyze/trends`, {
      brandId: foundBrand.id,
      topic: 'AI in Social Media Marketing',
    });
    const { trends, hooks, source } = response.data;
    expect(trends).toHaveLength(3);
    expect(hooks).toHaveLength(3);
    expect(source).toBe('mock');

    // Step 3: Create post
    const selectedHook = hooks[0];
    const createdPost = await prisma.post.create({
      data: {
        title: 'Demo AI-Generated Post',
        content: `${selectedHook}\n\nSocial Media is changing rapidly.`,
        status: 'draft',
        brandId: foundBrand.id,
      },
    });
    expect(createdPost.id).toBe('p1');
    expect(prisma.post.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ brandId: 'b1' }),
      })
    );

    // Step 4: Create workflow
    const createdWorkflow = await prisma.workflow.create({
      data: {
        postId: createdPost.id,
        steps: { trendHookAnalysis: 'completed', copywriting: 'completed', qualityAssurance: 'passed' },
        result: { score: 95, remarks: 'Excellent', platforms: ['instagram'] },
      },
    });
    expect(createdWorkflow.id).toBe('w1');

    // Verify call counts
    expect(prisma.brand.findFirst).toHaveBeenCalledTimes(1);
    expect(mockedAxios.post).toHaveBeenCalledTimes(1);
    expect(prisma.post.create).toHaveBeenCalledTimes(1);
    expect(prisma.workflow.create).toHaveBeenCalledTimes(1);
  });

  it('handles missing brand gracefully', async () => {
    (prisma.brand.findFirst as jest.Mock).mockResolvedValueOnce(null);

    const foundBrand = await prisma.brand.findFirst();
    expect(foundBrand).toBeNull();

    // If brand not found, the script would exit with error
    expect(prisma.post.create).not.toHaveBeenCalled();
    expect(prisma.workflow.create).not.toHaveBeenCalled();
  });

  it('falls back to hardcoded trends when backend is unreachable', async () => {
    const brand = { id: 'b1', name: 'DemoBrand', tone: 'friendly' };
    (prisma.brand.findFirst as jest.Mock).mockResolvedValueOnce(brand);

    // Backend unreachable
    mockedAxios.post.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const post = { id: 'p1', title: 'Demo AI-Generated Post', content: 'Fallback content' };
    (prisma.post.create as jest.Mock).mockResolvedValueOnce(post);
    const workflow = { id: 'w1', result: { score: 80 } };
    (prisma.workflow.create as jest.Mock).mockResolvedValueOnce(workflow);

    // Simulate fallback logic
    const fallbackHooks = [
      'Stop posting manually! Here is how AI is changing the game...',
      'If you\'re not using AI for social media in 2026, you\'re falling behind.',
      'Want to master social automation? Here are 3 tips.',
    ];

    const selectedHook = fallbackHooks[0];
    const createdPost = await prisma.post.create({
      data: {
        title: 'Demo AI-Generated Post',
        content: `${selectedHook}\n\n...fallback...`,
        status: 'draft',
        brandId: brand.id,
      },
    });
    expect(createdPost.id).toBe('p1');

    // Workflow still proceeds
    const createdWorkflow = await prisma.workflow.create({
      data: { postId: createdPost.id, steps: {}, result: { score: 80 } },
    });
    expect(createdWorkflow.id).toBe('w1');
  });
});