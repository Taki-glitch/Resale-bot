/**
 * Connecteurs de sources d'annonces.
 *
 * RÈGLE ABSOLUE : un connecteur ne peut utiliser qu'une interface, un flux ou une méthode d'accès AUTORISÉE par la plateforme
 * (API officielle, partenariat, flux fourni explicitement). Aucun contournement de CAPTCHA, d'authentification, de protection
 * anti-robot ou de limite d'accès. Aucune collecte par simple lecture des pages publiques.
 *
 * Aujourd'hui AUCUN connecteur autorisé n'est fourni : le registre est vide et le fonctionnement reste manuel.
 * Pour en ajouter un : implémenter `SourceConnector`, l'enregistrer ci-dessous, puis créer une ligne `sources`
 * (is_authorized = true, is_enabled = true, connector = <nom>, config = quotas) après avoir vérifié les conditions de la plateforme.
 */
export interface RawListing {
  externalId: string;
  title: string;
  priceCents: number | null;
  url: string | null;
  description: string | null;
  condition: string | null;
  location: string | null;
}

export interface SourceConfig {
  minIntervalMinutes?: number; // fréquence minimale entre deux appels
  dailyQuota?: number; // nombre maximal d'annonces importées par jour
  [k: string]: unknown;
}

export interface SourceConnector {
  readonly name: string;
  readonly platform: 'vinted' | 'leboncoin' | 'other';
  fetchNewListings(config: SourceConfig, since: Date | null): Promise<RawListing[]>;
}

const REGISTRY: Record<string, SourceConnector> = {};

export const getConnector = (name: string): SourceConnector | null => REGISTRY[name] ?? null;
export const registeredConnectors = (): string[] => Object.keys(REGISTRY);
