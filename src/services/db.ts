import { supabase } from '../lib/supabase.ts';

export function db() {
  if (!supabase) throw new Error('Supabase non configuré.');
  return supabase;
}
