/**
 * Import manuel d'annonces : analyse d'URL et détection de doublons.
 * Aucune requête réseau : l'URL est seulement lue pour en déduire la plateforme et l'identifiant.
 */

export type Platform = 'vinted' | 'leboncoin' | 'manual' | 'other';

export interface ParsedUrl {
  platform: Platform;
  externalId: string | null;
  normalizedUrl: string;
}

/** Normalise une URL : sans protocole, sans "www.", sans paramètres, sans "/" final. */
export function normalizeUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    const path = u.pathname.replace(/\/+$/, '');
    return `${host}${path}`;
  } catch {
    return null;
  }
}

/**
 * Déduit la plateforme et l'identifiant d'annonce depuis l'URL (au mieux).
 * Si le format n'est pas reconnu, externalId vaut null : l'import fonctionne quand même.
 */
export function parseListingUrl(raw: string): ParsedUrl | null {
  const normalized = normalizeUrl(raw);
  if (!normalized) return null;
  const host = normalized.split('/')[0];
  let platform: Platform = 'other';
  let externalId: string | null = null;
  if (/(^|\.)vinted\.[a-z.]+$/.test(host)) {
    platform = 'vinted';
    externalId = normalized.match(/\/items\/(\d+)/)?.[1] ?? null;
  } else if (/(^|\.)leboncoin\.fr$/.test(host)) {
    platform = 'leboncoin';
    externalId = (normalized.match(/\/ad\/[^/]+\/(\d+)/) ?? normalized.match(/\/(\d{6,})\.htm/))?.[1] ?? null;
  }
  return { platform, externalId, normalizedUrl: normalized };
}

const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/**
 * Empreinte de déduplication.
 * Priorité : identifiant d'annonce reconnu > URL normalisée > titre + prix.
 */
export function fingerprint(a: { url?: string | null; title: string; priceCents: number | null }): string {
  if (a.url) {
    const parsed = parseListingUrl(a.url);
    if (parsed?.externalId) return `p:${parsed.platform}:${parsed.externalId}`;
    if (parsed) return `u:${parsed.normalizedUrl}`;
  }
  return `t:${slug(a.title)}|${a.priceCents ?? ''}`;
}
