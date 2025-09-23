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

  vite: {
    ssr: {
      external: ["micromatch"],
    },
  },

  env: {
    schema: {
      SUPABASE_URL: envField.string({ context: "server", access: "secret" }),
      SUPABASE_ANON_KEY: envField.string({ context: "server", access: "secret" }),
      SUPABASE_SERVICE_ROLE_KEY: envField.string({ context: "server", access: "secret" }),
      PORT: envField.number({ context: "server", access: "public", default: 4000 }),
      NODE_ENV: envField.string({ context: "server", access: "public", default: "development" }),
      FRONTEND_URL: envField.string({ context: "server", access: "public", default: "http://localhost:4321" }),
      ALLOWED_ORIGINS: envField.string({ context: "server", access: "public", default: "http://localhost:4321,http://localhost:3000" }),
      JWT_SECRET: envField.string({ context: "server", access: "secret" }),
    }
  }
});