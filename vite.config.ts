import { defineConfig, loadEnv } from 'vite';
import { createApi } from './server/api.mjs';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react(), {
    name: 'parallax-api',
    configureServer(server) {
      const local = loadEnv(server.config.mode, process.cwd(), 'PARALLAX_');
      server.middlewares.use(createApi({ getConfig: () => ({ ...local, ...process.env }) }));
    },
  }],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
} as any);
