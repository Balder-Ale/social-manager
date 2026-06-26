import { defineConfig } from '@prisma/client/runtime';

export default defineConfig({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
