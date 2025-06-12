import { supabase } from "../../lib/supabase";

export const POST = async ({ cookies, redirect }: any) => {
  console.log("signing out");
  await supabase.auth.signOut();
  
  cookies.delete("sb-access-token");
  cookies.delete("sb-refresh-token");
  
  return redirect("/");
}; 