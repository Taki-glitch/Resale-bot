import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** false si les variables manquent ou si l'URL n'est pas une vraie adresse https. */
export const isConfigured = Boolean(url && anonKey && /^https?:\/\//.test(url));

export const supabase = isConfigured ? createClient(url!, anonKey!) : null;
