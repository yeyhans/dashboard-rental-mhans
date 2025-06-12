import { defineMiddleware } from "astro:middleware";
import { supabase } from "../lib/supabase";
import micromatch from "micromatch";

const { isMatch } = micromatch;

const protectedRoutes = ["/dashboard(|/)", "/orders(|/)", "/users(|/)", "/payments-table(|/)", "/products(|/)"];
const authRoutes = ["/api/auth/signin", "/api/auth/signout"];
const homeRoute = "/";
const dashboardRoute = "/dashboard";

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, cookies, redirect, locals } = context;

  // Allow auth routes to pass through
  if (isMatch(url.pathname, authRoutes)) {
    return next();
  }

  const accessToken = cookies.get("sb-access-token");
  const refreshToken = cookies.get("sb-refresh-token");

  // Redirect to dashboard if user is logged in and tries to access the home page
  if (url.pathname === homeRoute && accessToken && refreshToken) {
    return redirect(dashboardRoute);
  }

  // If it's not a protected route, just continue
  if (!isMatch(url.pathname, protectedRoutes)) {
    return next();
  }
  
  // From here, we are dealing with a protected route
  
  if (!accessToken || !refreshToken) {
    return redirect(homeRoute);
  }

  const { data, error } = await supabase.auth.setSession({
    refresh_token: refreshToken.value,
    access_token: accessToken.value,
  });

  if (error) {
    // Clear cookies on error and redirect
    cookies.delete("sb-access-token", { path: "/" });
    cookies.delete("sb-refresh-token", { path: "/" });
    return redirect(homeRoute);
  }

  // Set local user data
  locals.email = data.user?.email ?? "";

  // Refresh cookies with new tokens
  const accessTokenExpiresIn = data.session?.expires_in ?? 3600;
  const refreshTokenMaxAge = 7 * 24 * 60 * 60; // 7 days

  cookies.set("sb-access-token", data.session!.access_token, {
    sameSite: "strict",
    path: "/",
    secure: true,
    maxAge: Math.floor(accessTokenExpiresIn),
    httpOnly: true
  });

  cookies.set("sb-refresh-token", data.session!.refresh_token, {
    sameSite: "strict",
    path: "/",
    secure: true,
    maxAge: refreshTokenMaxAge,
    httpOnly: true
  });

  return next();
}); 