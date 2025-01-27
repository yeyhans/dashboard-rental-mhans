import type { APIRoute } from "astro";
import { supabase } from "../../../lib/supabase";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString();
  const password = formData.get("password")?.toString();

  console.log("Datos del formulario recibidos:", { email, password }); // Log para verificar los datos del formulario

  if (!email || !password) {
    console.log("Error: Email y contraseña son requeridos"); // Log para errores de validación
    return new Response("Email and password are required", { status: 400 });
  }

  console.log("Intentando iniciar sesión con Supabase..."); // Log antes de la llamada a Supabase
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    console.log("Error durante el inicio de sesión:", error); // Log para errores de Supabase
    return new Response(error.message, { status: 500 });
  }

  console.log("Inicio de sesión exitoso. Datos de la sesión:", data); // Log para verificar los datos de la sesión

  const { access_token, refresh_token } = data.session;
  console.log("Tokens generados:", { access_token, refresh_token }); // Log para verificar los tokens

  cookies.set("sb-access-token", access_token, {
    sameSite: "strict",
    path: "/",
    secure: true,
  });
  cookies.set("sb-refresh-token", refresh_token, {
    sameSite: "strict",
    path: "/",
    secure: true,
  });

  console.log("Cookies establecidas correctamente. Redirigiendo al dashboard..."); // Log antes de la redirección
  return redirect("/dashboard");
};