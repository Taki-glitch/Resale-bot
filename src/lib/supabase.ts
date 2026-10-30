import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** false tant que les variables d'environnement ne sont pas renseignées. */
export const isConfigured = Boolean(url && anonKey);

// La clé "anon" est publique par conception ; l'accès aux données est protégé par les politiques RLS.
export const supabase = isConfigured ? createClient(url!, anonKey!) : null;
