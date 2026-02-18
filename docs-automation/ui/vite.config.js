import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    proxy: {
      '/api': 'http://localhost:3333',
      '/assets': 'http://localhost:3333',
    },
  },
});

