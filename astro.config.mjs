// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import tailwind from '@astrojs/tailwind';

// https://astro.build/config
export default defineConfig({
  site: 'https://recipes.siwachter.com',
  output: 'server',
  // TLS is terminated upstream (Cloudflare/Traefik), so the Node server sees
  // plain http and Astro's origin check (origin header `https://…` !== url
  // origin `http://…`) 403s every multipart form POST — i.e. recipe submission.
  // The submit endpoint is public/unauthenticated and already guarded by a
  // honeypot, a captcha, and rate limiting, so we disable the origin check.
  security: { checkOrigin: false },
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [tailwind()],
});
