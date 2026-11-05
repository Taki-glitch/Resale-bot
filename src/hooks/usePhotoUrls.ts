import { useEffect, useState } from 'react';
import { signedUrls } from '../services/photos.ts';

/** Liens d'affichage des photos (chemin -> URL signée). */
export function usePhotoUrls(paths: string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = paths.join('|');
  useEffect(() => {
    let alive = true;
    if (paths.length === 0) {
      setUrls({});
      return;
    }
    signedUrls(paths)
      .then((u) => {
        if (alive) setUrls(u);
      })
      .catch(() => {
        /* photos facultatives : on affiche l'espace réservé */
      });
    return () => {
      alive = false;
    };
  }, [key]);
  return urls;
}
