
export interface OpportunityScoreInput {
  purchaseCents: number | null;
  resaleCents: number | null;
  soldComparables: number;
  askingComparables: number;
  confidence: number | null;
  sufficientData: boolean;
  condition: string | null;
  location: string | null;
  maxPurchaseCents?: number;
  minProfitCents?: number;
  minRoiPct?: number;
}

export interface OpportunityScore {
  score: number;
  risk: 'low' | 'medium' | 'high';
  eligible: boolean;
  estimatedProfitCents: number | null;
  roiPct: number | null;
  reasons: string[];
  missing: string[];
}

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

/**
 * Score explicable sur 100. Il ne constitue ni une garantie de vente ni une authentification.
 * La marge est calculée avant frais tant que les frais de revente ne sont pas connus.
 */
export function scoreOpportunity(input: OpportunityScoreInput): OpportunityScore {
  const missing: string[] = [];
  const reasons: string[] = [];
  const price = input.purchaseCents;
  const resale = input.resaleCents;

  if (price == null || price <= 0) missing.push('Prix d’achat manquant');
  if (resale == null || resale <= 0) missing.push('Estimation de revente indisponible');
  if (input.soldComparables + input.askingComparables < 3) missing.push('Moins de 3 comparables');
  if (input.confidence == null) missing.push('Confiance IA inconnue');

  const profit = price != null && resale != null ? resale - price : null;
  const roi = profit != null && price != null && price > 0 ? (profit / price) * 100 : null;
  let score = 0;

  // Potentiel financier : 40 points
  if (profit != null && roi != null) {
    score += clamp((roi / Math.max(input.minRoiPct ?? 40, 1)) * 25, 0, 25);
    score += clamp((profit / Math.max(input.minProfitCents ?? 1000, 1)) * 15, 0, 15);
    reasons.push(`Écart estimé après frais de plateforme configurés : ${(profit / 100).toFixed(2)} € avant frais`);
  }

  // Qualité des comparables : 25 points
  const sold = input.soldComparables;
  const asking = input.askingComparables;
  score += Math.min(sold, 5) * 4 + Math.min(asking, 5) * 1;
  if (sold >= 3) reasons.push(`${sold} ventes réalisées comparables`);
  else if (asking + sold >= 3) reasons.push('Estimation reposant au moins en partie sur des prix affichés');

  // Fiabilité IA : 20 points
  if (input.confidence != null) score += clamp(input.confidence, 0, 1) * 15;
  if (input.sufficientData) score += 5;
  else missing.push('Analyse IA jugée insuffisante');

  // État et logistique : 15 points
  const condition = (input.condition ?? '').toLocaleLowerCase('fr');
  if (condition.includes('neuf')) score += 10;
  else if (condition.includes('très bon')) score += 8;
  else if (condition.includes('bon')) score += 6;
  else if (condition.includes('satisfaisant')) score += 3;
  else missing.push('État à préciser');
  if (input.location?.trim()) score += 5;
  else missing.push('Localisation manquante');

  const enoughEvidence = price != null && resale != null &&
    sold + asking >= 3 && input.confidence != null && input.sufficientData;
  if (!enoughEvidence) score = Math.min(score, 49);
  if (profit != null && profit <= 0) score = Math.min(score, 20);
  if (input.maxPurchaseCents != null && price != null && price > input.maxPurchaseCents) {
    score = Math.min(score, 35);
    reasons.push('Prix demandé supérieur au budget maximal par article');
  }

  const finalScore = Math.round(clamp(score, 0, 100));
  const risk: OpportunityScore['risk'] =
    !enoughEvidence || finalScore < 40 ? 'high' : finalScore >= 75 ? 'low' : 'medium';

  return {
    score: finalScore,
    risk,
    eligible: enoughEvidence && profit != null && profit > 0,
    estimatedProfitCents: profit,
    roiPct: roi == null ? null : Math.round(roi * 10) / 10,
    reasons,
    missing: [...new Set(missing)],
  };
}
