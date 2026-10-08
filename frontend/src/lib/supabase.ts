import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ?? "https://yghxaxynuudphojqbqou.supabase.co";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ??
  "sb_publishable_2WumkWqrqdwYlN0kZBHoqA_kdhLWU9z";

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
