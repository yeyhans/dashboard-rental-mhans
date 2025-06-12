import { defineMiddleware } from "astro:middleware";
import { supabase } from "../src/lib/supabase";
import * as micromatch from "micromatch";

const protectedRoutes = ["/dashboard(|/)", "/orders(|/)", "/users(|/)", "/products(|/)", "/payments-table(|/)"];
const redirectRoutes = ["/signin(|/)", "/register(|/)", "/(|/)"];
const proptectedAPIRoutes = ["/api/guestbook(|/)"];

export const onRequest = defineMiddleware(
  async ({ locals, url, cookies, redirect }, next) => {
    if (micromatch.isMatch(url.pathname, protectedRoutes)) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token");

      if (!accessToken || !refreshToken) {
        return redirect("/");
      }

      const { data, error } = await supabase.auth.setSession({
        refresh_token: refreshToken.value,
        access_token: accessToken.value,
      });

      if (error) {
        cookies.delete("sb-access-token", {
          path: "/",
        });
        cookies.delete("sb-refresh-token", {
          path: "/",
        });
        return redirect("/");
      }

      locals.email = data.user?.email!;
      
      const accessTokenExpiresIn = data?.session?.expires_in ?? 3600; // Default a 1 hora (3600s)
      const refreshTokenMaxAge = 7 * 24 * 60 * 60; // 7 días en segundos
      
      cookies.set("sb-access-token", data?.session?.access_token!, {
        sameSite: "strict",
        path: "/",
        secure: true,
        maxAge: accessTokenExpiresIn
      });
      cookies.set("sb-refresh-token", data?.session?.refresh_token!, {
        sameSite: "strict",
        path: "/",
        secure: true,
        maxAge: refreshTokenMaxAge
      });
    }

    if (micromatch.isMatch(url.pathname, redirectRoutes)) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token");

      if (accessToken && refreshToken) {
        return redirect("/dashboard");
      }
    }

    if (micromatch.isMatch(url.pathname, proptectedAPIRoutes)) {
      const accessToken = cookies.get("sb-access-token");
      const refreshToken = cookies.get("sb-refresh-token");

      // Check for tokens
      if (!accessToken || !refreshToken) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
          }),
          { status: 401 },
        );
      }

      // Verify the tokens
      const { error } = await supabase.auth.setSession({
        access_token: accessToken.value,
        refresh_token: refreshToken.value,
      });

      if (error) {
        return new Response(
          JSON.stringify({
            error: "Unauthorized",
          }),
          { status: 401 },
        );
      }
    }

    return next();
  },
);