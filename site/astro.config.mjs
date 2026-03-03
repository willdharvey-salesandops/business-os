import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import vercel from '@astrojs/vercel/serverless';

export default defineConfig({
  site: 'https://leadershipgrowthconsulting.com',
  output: 'hybrid',
  adapter: vercel({ maxDuration: 60 }),
  integrations: [tailwind()],
});
