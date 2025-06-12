// Con `output: 'hybrid'` configurado:
// export const prerender = false;
import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    return new Response("Correo electrónico y contraseña obligatorios", { status: 400 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return new Response(error.message, { status: 500 });
  }

  const { access_token, refresh_token } = data.session;
  
  // Configurar las cookies con mayor seguridad y duración apropiada
  const accessTokenExpiresIn = data?.session?.expires_in ?? 3600; // Default a 1 hora (3600s)
  const refreshTokenMaxAge = 7 * 24 * 60 * 60; // 7 días en segundos
  
  cookies.set("sb-access-token", access_token, {
    sameSite: "strict",
    path: "/",
    secure: true,
    maxAge: accessTokenExpiresIn,
    httpOnly: true
  });
  
  cookies.set("sb-refresh-token", refresh_token, {
    sameSite: "strict", 
    path: "/",
    secure: true,
    maxAge: refreshTokenMaxAge,
    httpOnly: true
  });
  
  return redirect("/dashboard");
};