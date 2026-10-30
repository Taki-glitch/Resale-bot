import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase.ts';
import { DEFAULT_SETTINGS, mergeSettings } from '../core/settings.ts';
import type { Settings } from '../core/settings.ts';
import { useAuth } from './useAuth.tsx';

/** Charge et enregistre les réglages de l'utilisateur (colonne users.settings). */
export function useSettings() {
  const { session } = useAuth();
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase || !session) return;
    supabase
      .from('users')
      .select('settings')
      .eq('id', session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        else setSettings(mergeSettings(data?.settings));
        setLoading(false);
      });
  }, [session]);

  const save = useCallback(
    async (next: Settings): Promise<string | null> => {
      if (!supabase || !session) return 'Non connecté.';
      const { error } = await supabase.from('users').update({ settings: next }).eq('id', session.user.id);
      if (error) return error.message;
      setSettings(next);
      return null;
    },
    [session],
  );

  return { settings, loading, error, save };
}
