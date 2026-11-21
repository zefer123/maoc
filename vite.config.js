import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = `http://127.0.0.1:${env.PORT || 8787}`;
  const proxy = { '/api': { target }, '/ws': { target, ws: true } };
  return { plugins: [react()], server: { proxy }, preview: { proxy } };
});