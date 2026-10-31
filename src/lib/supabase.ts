import { createClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** Ne garde que https://xxxx.supabase.co, quel que soit le chemin collé par erreur. */
function cleanUrl(value?: string): string | null {
  try {
    const u = new URL((value ?? '').trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.origin : null;
  } catch {
    return null;
  }
}

const url = cleanUrl(rawUrl);

export const isConfigured = Boolean(url && anonKey);

export const supabase = isConfigured ? createClient(url!, anonKey!.trim()) : null;
