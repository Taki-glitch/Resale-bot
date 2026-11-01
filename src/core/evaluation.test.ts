import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateListing, OVERPRICED_PCT } from './evaluation.ts';
import type { EvaluationInput } from './evaluation.ts';

const NOW = new Date('2026-11-01T12:00:00Z');
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000).toISOString();
const sold = (priceCents: number, days = 10) => ({ priceCents, kind: 'sold' as const, observedAt: daysAgo(days) });
const asking = (priceCents: number) => ({ priceCents, kind: 'asking' as const, observedAt: daysAgo(3) });

const input = (over: Partial<EvaluationInput> = {}): EvaluationInput => ({
  listing: {
    priceCents: 2000,
    condition: 'Très bon état',
    description: 'Veste en très bon état, portée deux fois, taille M, vendue avec sa housse d\'origine et sa facture.',
    url: 'https://www.vinted.fr/items/123456-veste',
    location: 'Lyon',
  },
  comparables: [sold(4000), sold(4100), sold(3900), sold(4000), sold(4050)],
  analysis: { confidence: 0.8, sufficientData: true, visibleDefects: [], riskFlags: [] },
  settings: {
    minProfitCents: 500,
    minRoiPct: 30,
    maxPerItemCents: 5000,
    fee: { percent: 5, fixedCents: 70 },
    otherCostsCents: 300,
  },
  now: NOW,
  ...over,
});

test('moins de 3 comparables : non évaluable, aucun score inventé', () => {
  const e = evaluateListing(input({ comparables: [sold(4000), sold(4100)] }));
  assert.equal(e.recommendation, 'insufficient');
  assert.equal(e.score, null);
  assert.equal(e.risk, null);
  assert.equal(e.netProfitCents, null);
  assert.match(e.justification[0], /insuffisamment documentée/);
});

test('prix demandé inconnu : non évaluable', () => {
  const e = evaluateListing(input({ listing: { ...input().listing, priceCents: null } }));
  assert.equal(e.recommendation, 'insufficient');
});

test('excellente affaire : bon score, bénéfice sûr même en scénario prudent, confiance suffisante', () => {
  const e = evaluateListing(input());
  assert.equal(e.recommendation, 'excellent');
  assert.ok((e.score ?? 0) >= 80);
  assert.equal(e.resaleEstimateCents, 4000);
  assert.equal(e.netProfitCents, 4000 - 2000 - 270 - 300); // 1430
  assert.ok((e.cautiousNetProfitCents ?? 0) >= 500);
  assert.equal(e.priceFlag, 'underpriced');
  assert.equal(e.risk, 'low');
});

test("prix d'achat maximal cohérent avec le bénéfice minimum", () => {
  const e = evaluateListing(input());
  assert.equal(e.maxBuyCents, 4000 - 270 - 300 - 500);
});

test('sans ventes récentes la demande rapporte 0 : pas d\'excellente affaire', () => {
  const e = evaluateListing(input({ comparables: [4000, 4100, 3900, 4000, 4050].map((p) => sold(p, 400)) }));
  assert.notEqual(e.recommendation, 'excellent');
  assert.ok((e.score ?? 100) <= 75);
});

test('prix affichés seulement, sans analyse : jamais « bonne affaire », risque signalé', () => {
  const e = evaluateListing(input({ comparables: [4000, 4100, 3900, 4000].map(asking), analysis: null }));
  assert.ok(e.recommendation === 'conditional' || e.recommendation === 'poor');
  assert.equal(e.estimate.basis, 'asking');
  assert.ok(e.risks.some((r) => /prix affichés/.test(r)));
  assert.ok(e.confidence < 0.5);
});

test('prix trop élevé : à éviter et prix anormalement élevé signalé', () => {
  const e = evaluateListing(input({ listing: { ...input().listing, priceCents: 5000 } }));
  assert.equal(e.recommendation, 'avoid');
  assert.equal(e.priceFlag, 'overpriced');
  assert.ok((e.priceVsMarketPct ?? 0) >= OVERPRICED_PCT);
  assert.ok(e.conditions.some((c) => /Négocier/.test(c)));
});

test('budget maximal par article dépassé : au mieux « sous conditions »', () => {
  const e = evaluateListing(input({ settings: { ...input().settings, maxPerItemCents: 1500 } }));
  assert.equal(e.recommendation, 'conditional');
  assert.ok(e.conditions.some((c) => /budget maximal/.test(c)));
});

test('risque élevé : annonce peu documentée', () => {
  const e = evaluateListing(
    input({
      comparables: [4000, 4100, 3900].map(asking),
      analysis: null,
      listing: { priceCents: 2000, condition: 'Inconnu', description: 'ok', url: null, location: null },
    }),
  );
  assert.equal(e.risk, 'high');
  assert.ok(e.conditions.some((c) => /état et l'authenticité/.test(c)));
});

test('la confiance augmente avec le nombre de ventes réalisées', () => {
  const few = evaluateListing(input({ comparables: [4000, 4000, 4000].map((p) => sold(p)) }));
  const many = evaluateListing(input({ comparables: Array.from({ length: 8 }, () => sold(4000)) }));
  assert.ok(many.confidence > few.confidence);
});

test('recalibrage des poids pris en compte', () => {
  const e = evaluateListing(
    input({ settings: { ...input().settings, weights: { margin: 100, demand: 0, resale: 0, reliability: 0, condition: 0, logistics: 0 } } }),
  );
  assert.equal(e.score, 100);
});

test('la signature change quand une donnée change', () => {
  const a = evaluateListing(input());
  const b = evaluateListing(input({ comparables: [4000, 4100, 3900, 4000, 3000].map((p) => sold(p)) }));
  assert.notEqual(a.signature, b.signature);
  assert.equal(a.signature, evaluateListing(input()).signature);
});
