import { db } from './db.ts';
import type { AnalysisRow } from '../types.ts';

/** Lance l'analyse IA (Edge Function "analyze-listing"). Les photos ne sont pas conservées. */
export async function runAnalysis(
  listingId: string,
  images: { media_type: string; data: string }[],
): Promise<AnalysisRow> {
  const { data, error } = await db().functions.invoke('analyze-listing', {
    body: { listing_id: listingId, images },
  });
  if (error) {
    let message = error.message;
    const ctx = (error as unknown as { context?: Response }).context;
    if (ctx && typeof ctx.json === 'function') {
      try {
        const j = await ctx.json();
        if (j?.error) message = String(j.error);
      } catch {
        /* garde le message générique */
      }
    }
    throw new Error(message);
  }
  if (!data?.analysis) throw new Error('Réponse vide du service d\'analyse.');
  return data.analysis as AnalysisRow;
}
