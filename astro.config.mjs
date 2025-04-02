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

  env: {
    schema: {
      SUPABASE_ANON_KEY: envField.string({ context: "server", access: "secret" }),
      SUPABASE_URL: envField.string({ context: "server", access: "secret" }),
      WORDPRESS_USERNAME: envField.string({ context: "server", access: "secret" }),
      WORDPRESS_PASSWORD: envField.string({ context: "server", access: "secret" }),
      WOOCOMMERCE_CONSUMER_KEY: envField.string({ context: "server", access: "secret" }),
      WOOCOMMERCE_CONSUMER_SECRET: envField.string({ context: "server", access: "secret" }),
    }
  }
});