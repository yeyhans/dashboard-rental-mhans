import type { APIRoute } from "astro";
import { supabase } from "../../lib/supabase";

export const POST: APIRoute = async ({ cookies, redirect }) => {
  await supabase.auth.signOut();
  
  cookies.delete("sb-access-token");
  cookies.delete("sb-refresh-token");
  
  return redirect("/");
}; 