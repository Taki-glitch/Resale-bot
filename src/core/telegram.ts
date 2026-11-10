/** Notifications Telegram (facultatives). Texte brut uniquement (aucun balisage interprété) et seulement pour les types importants. */
export const TELEGRAM_TYPES = ['opportunity', 'price_drop', 'reevaluation_needed', 'stock_aging', 'recommendation_changed'];

export const shouldSendTelegram = (type: string): boolean => TELEGRAM_TYPES.includes(type);

export function formatTelegramMessage(n: { title: string; body: string | null }, appUrl?: string): string {
  const parts = [n.title, n.body ?? '', appUrl ? `Ouvrir : ${appUrl}` : ''].filter((p) => p.trim() !== '');
  const text = parts.join('\n\n');
  return text.length > 3500 ? `${text.slice(0, 3497)}...` : text;
}

/** Un identifiant de conversation Telegram est un entier (éventuellement négatif pour les groupes). */
export const isValidChatId = (v: string): boolean => /^-?\d{5,20}$/.test(v.trim());
