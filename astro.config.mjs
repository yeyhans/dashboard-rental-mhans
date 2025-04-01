import { defineConfig, envField } from "astro/config";
import vercel from "@astrojs/vercel/serverless";
import tailwind from "@astrojs/tailwind";

import react from "@astrojs/react";

// https://astro.build/config
export default defineConfig({
  site: "https://astro-supabase-auth.vercel.app",
  output: "server",
  adapter: vercel(),
  integrations: [tailwind(), react()],

  env: {
    schema: {
      SUPABASE_ANON_KEY: envField.string({ context: "server", access: "secret" }),
      SUPABASE_URL: envField.string({ context: "server", access: "secret" }),
    }
  }
});