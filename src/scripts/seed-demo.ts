import { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { uploadFile } from '../utils/storage';

const prisma = new PrismaClient();

async function main() {
  // Tenant
  const tenant = await prisma.tenant.create({
    data: {
      id: uuidv4(),
      name: 'DemoTenant',
    },
  });

  // User (admin) – password hash placeholder
  const passwordHash = '$2b$10$abcdefghijklmnopqrstuvwxzyABCDEFGHIJKLMNO';
  await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {}, // keep existing user (could update tenantId if needed)
    create: {
      id: uuidv4(),
      email: 'admin@example.com',
      password: passwordHash,
      role: 'ADMIN',
      tenantId: tenant.id,
      language: 'it',
    },
  });

  // Logo upload (optional – if file exists)
  let logoUrl: string | undefined = undefined;
  const logoPath = path.resolve(__dirname, '../../assets/logo-demo.png');
  if (fs.existsSync(logoPath)) {
    const logoBuffer = fs.readFileSync(logoPath);
    logoUrl = await uploadFile(`logo-${uuidv4()}.png`, logoBuffer, 'image/png');
  }

  // Brand
  const brand = await prisma.brand.create({
    data: {
      id: uuidv4(),
      tenantId: tenant.id,
      name: 'DemoBrand',
      tone: 'friendly',
      paletteJson: {
        primary: '#0A8743',
        secondary: '#F4E04D',
        background: '#FFFFFF',
        text: '#000000',
      },
      fontsJson: {
        heading: 'Montserrat',
        body: 'Open Sans',
      },
      logoUrl,
      guidelines: '## Demo Brand Guidelines\n- Friendly tone\n- Green palette\n- No profanity',
    },
  });

  console.log('✅  Demo tenant & brand created');
  console.log({ tenantId: tenant.id, brandId: brand.id });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
