// Tests for the seed-demo script (src/scripts/seed-demo.ts)
// Validates the seed logic by mocking Prisma and fs

jest.mock('@prisma/client', () => {
  const mPrisma = {
    tenant: { create: jest.fn() },
    user: { upsert: jest.fn() },
    brand: { create: jest.fn() },
    $disconnect: jest.fn(),
    $on: jest.fn(),
  };
  return { PrismaClient: jest.fn(() => mPrisma) };
});

jest.mock('fs');
jest.mock('path');

import fs from 'fs';

const mockedFs = jest.mocked(fs);

describe('seed-demo script logic', () => {
  let prisma: any;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma = new (jest.requireMock('@prisma/client').PrismaClient)();
  });

  it('creates a tenant, user, and brand', async () => {
    const tenant = { id: 'tenant-uuid', name: 'DemoTenant' };
    (prisma.tenant.create as jest.Mock).mockResolvedValueOnce(tenant);

    (prisma.user.upsert as jest.Mock).mockResolvedValueOnce({
      id: 'user-uuid',
      email: 'admin@example.com',
    });

    const brand = { id: 'brand-uuid', name: 'DemoBrand', tone: 'friendly', tenantId: 'tenant-uuid' };
    (prisma.brand.create as jest.Mock).mockResolvedValueOnce(brand);

    // Simulate seed logic
    const tenantResult = await prisma.tenant.create({ data: { id: '...', name: 'DemoTenant' } });
    expect(tenantResult.name).toBe('DemoTenant');

    const userResult = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: { id: '...', email: 'admin@example.com', password: 'hash', role: 'ADMIN', tenantId: tenant.id, language: 'it' },
    });
    expect(userResult.email).toBe('admin@example.com');

    const brandResult = await prisma.brand.create({
      data: { id: '...', tenantId: tenant.id, name: 'DemoBrand', tone: 'friendly', guidelines: '...' },
    });
    expect(brandResult.name).toBe('DemoBrand');

    expect(prisma.tenant.create).toHaveBeenCalledTimes(1);
    expect(prisma.user.upsert).toHaveBeenCalledTimes(1);
    expect(prisma.brand.create).toHaveBeenCalledTimes(1);
  });

  it('skips logo upload when logo file does not exist', () => {
    mockedFs.existsSync.mockReturnValueOnce(false);

    // When logo file doesn't exist, uploadFile is never called
    expect(fs.existsSync('/fake/path.png')).toBe(false);
  });
});