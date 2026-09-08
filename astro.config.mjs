import { defineConfig, envField } from "astro/config";
import vercel from "@astrojs/vercel";
import tailwind from "@astrojs/tailwind";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://dashboard-rental-mhans.vercel.app/",
  output: "server",
  adapter: vercel(),
  integrations: [tailwind(), react()],

  // Local dev only — the Vercel adapter ignores this, serverless functions do not bind a port.
  // Both apps are Astro and both default to 4321, so without this the one started first wins the
  // port and the other silently moves to 4322, inverting the CORS origins configured below and
  // the PUBLIC_BACKEND_URL the frontend points at. Pinning the dashboard here keeps 4321 for the
  // customer site, which is what every hardcoded origin in this repo already assumes.
  server: { port: 4322 },

  vite: {
    ssr: {
      external: ["micromatch"],
    },
    // CORS config solo aplica al dev server de Vite (no producción)
    server: process.env.NODE_ENV !== 'production' ? {
      cors: {
        origin: ['http://localhost:4321', 'http://localhost:3000'],
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
        allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
        exposedHeaders: ['Set-Cookie'],
        maxAge: 86400,
      },
      // node_modules es symlink a ../../dashboard/node_modules (worktree git):
      // Vite resuelve el symlink al path real, que queda fuera del fs.allow por defecto
      // (root del worktree). Sin esto, cualquier import de node_modules 403-ea en dev.
      fs: {
        allow: ['..', '../../dashboard'],
      },
    } : {},
  },

  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret" }),
      SUPABASE_ANON_KEY: envField.string({ context: "server", access: "secret" }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access: "secret" }),
      PORT: envField.number({ context: "server", access: "public", default: 4000 }),
      NODE_ENV: envField.string({ context: "server", access: "public", default: "development" }),
      PUBLIC_FRONTEND_URL: envField.string({ context: "server", access: "public", default: "http://localhost:4321" }),
      ALLOWED_ORIGINS: envField.string({ context: "server", access: "public", default: "http://localhost:4321,http://localhost:3000" }),
      JWT_SECRET: envField.string({ context: "server", access: "secret" }),
    }
  }
});