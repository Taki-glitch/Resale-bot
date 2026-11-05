/**
 * Préparation d'une annonce de revente. Aucune IA : prix calculés par le moteur financier, texte construit
 * uniquement à partir des informations saisies (rien n'est inventé). La publication reste manuelle.
 */
import { minResalePrice } from './profitability.ts';
import type { FeeModel } from './profitability.ts';

export interface ResalePriceInput {
  acquisitionCostCents: number; // achat + frais + remise en état
  fee: FeeModel;
  saleShippingCents: number;
  minProfitCents: number;
  estimateMedianCents: number | null; // issu des comparables, null si indisponible
}

export interface ResalePrices {
  minAcceptableCents: number | null; // en dessous, le bénéfice minimum n'est pas atteint
  breakEvenCents: number | null; // en dessous, perte
  suggestedCents: number | null;
  note: string;
}

export function suggestResalePrices(i: ResalePriceInput): ResalePrices {
  const base = { purchasePriceCents: i.acquisitionCostCents, fee: i.fee, saleShippingCents: i.saleShippingCents };
  const minAcceptable = minResalePrice({ ...base, minProfitCents: i.minProfitCents });
  const breakEven = minResalePrice({ ...base, minProfitCents: 0 });
  if (i.estimateMedianCents === null) {
    return {
      minAcceptableCents: minAcceptable,
      breakEvenCents: breakEven,
      suggestedCents: null,
      note: 'Estimation indisponible : ajoute des comparables pour obtenir un prix conseillé. Le prix minimum acceptable reste calculé.',
    };
  }
  if (minAcceptable !== null && i.estimateMedianCents < minAcceptable) {
    return {
      minAcceptableCents: minAcceptable,
      breakEvenCents: breakEven,
      suggestedCents: minAcceptable,
      note: 'Le marché observé est sous ton bénéfice minimum : le prix conseillé est ton minimum acceptable, la vente pourra être lente.',
    };
  }
  return { minAcceptableCents: minAcceptable, breakEvenCents: breakEven, suggestedCents: i.estimateMedianCents, note: 'Prix conseillé : estimation centrale des comparables.' };
}

export interface DraftInput {
  name: string;
  brand?: string | null;
  model?: string | null;
  category?: string | null;
  condition?: string | null;
  accessories?: string | null;
  notes?: string | null;
}

const clean = (s?: string | null): string => (s ?? '').trim();

export function buildResaleDraft(i: DraftInput): { title: string; description: string; keywords: string[] } {
  const parts = [clean(i.brand), clean(i.model)].filter(Boolean);
  const name = clean(i.name);
  const lowerParts = parts.join(' ').toLowerCase();
  const title = [name, ...parts.filter((p) => !name.toLowerCase().includes(p.toLowerCase()))].join(' ').slice(0, 80).trim();
  const lines: string[] = [title];
  if (clean(i.condition)) lines.push(`État : ${clean(i.condition)}.`);
  if (clean(i.accessories)) lines.push(`Accessoires inclus : ${clean(i.accessories)}.`);
  if (clean(i.notes)) lines.push(clean(i.notes));
  lines.push("N'hésitez pas à me poser vos questions. Envoi soigné.");
  const words = [name, lowerParts, clean(i.category)]
    .join(' ')
    .toLowerCase()
    .split(/[^a-z0-9àâçéèêëîïôûùüÿœ]+/i)
    .filter((w) => w.length >= 3);
  return { title, description: lines.join('\n'), keywords: Array.from(new Set(words)).slice(0, 12) };
}
