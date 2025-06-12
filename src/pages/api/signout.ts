import type { APIContext } from "astro";
import { supabase } from "../../lib/supabase";

export const POST = async ({ cookies, redirect }: APIContext) => {
  // Cerrar sesión en Supabase
  await supabase.auth.signOut();
  
  // Eliminar las cookies de sesión
  cookies.delete("sb-access-token", {
    path: "/",
  });
  cookies.delete("sb-refresh-token", {
    path: "/",
  });
  
  return redirect("/");
}; 