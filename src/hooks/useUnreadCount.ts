import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { countUnread } from '../services/notifications.ts';

/** Nombre de notifications non lues ; rafraîchi à chaque changement de page. */
export function useUnreadCount(): number {
  const { pathname } = useLocation();
  const [count, setCount] = useState(0);
  useEffect(() => {
    let alive = true;
    countUnread()
      .then((n) => {
        if (alive) setCount(n);
      })
      .catch(() => {
        /* le compteur est facultatif : on ignore l'erreur */
      });
    return () => {
      alive = false;
    };
  }, [pathname]);
  return count;
}
