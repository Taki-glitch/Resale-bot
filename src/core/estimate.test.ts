import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateResale } from './estimate.ts';

const sold = (priceCents: number) => ({ priceCents, kind: 'sold' as const });
const asking = (priceCents: number) => ({ priceCents, kind: 'asking' as const });

test('moins de 3 comparables : estimation indisponible', () => {
  const e = estimateResale([sold(3000), asking(3500)]);
  assert.equal(e.status, 'insufficient');
  assert.equal(e.medianCents, null);
  assert.match(e.warnings[0], /indisponible/);
});

test('3 ventes réalisées : base "sold", médiane et quartiles', () => {
  const e = estimateResale([1000, 2000, 3000, 4000, 5000].map(sold));
  assert.equal(e.status, 'ok');
  assert.equal(e.basis, 'sold');
  assert.equal(e.medianCents, 3000);
  assert.equal(e.lowCents, 2000);
  assert.equal(e.highCents, 4000);
  assert.equal(e.warnings.length, 0);
});

test('assez de ventes : les prix affichés sont ignorés', () => {
  const e = estimateResale([sold(2000), sold(2200), sold(2400), asking(9000), asking(9500)]);
  assert.equal(e.basis, 'sold');
  assert.equal(e.medianCents, 2200);
});

test('ventes insuffisantes : bascule sur les prix affichés avec avertissement', () => {
  const e = estimateResale([sold(2000), sold(2200), asking(2600), asking(3000)]);
  assert.equal(e.status, 'ok');
  assert.equal(e.basis, 'asking');
  assert.equal(e.warnings.length, 1);
  assert.equal(e.count, 4);
});

test('prix invalides ignorés', () => {
  const e = estimateResale([sold(0), sold(-5), sold(Number.NaN), sold(2000), sold(2100)]);
  assert.equal(e.status, 'insufficient');
  assert.equal(e.count, 2);
});

// ---- Estimation pondérée (V0.3 consolidée) ----
import { weightedPercentile } from './estimate.ts';

const NOW = new Date('2026-11-01T00:00:00Z');
const iso = (days: number) => new Date(NOW.getTime() - days * 86_400_000).toISOString();

test('un comparable ancien ou peu pertinent pèse moins qu\'un comparable récent et exact', () => {
  const e = estimateResale(
    [
      { priceCents: 3000, kind: 'sold', observedAt: iso(5), relevance: 1 },
      { priceCents: 3100, kind: 'sold', observedAt: iso(8), relevance: 1 },
      { priceCents: 3200, kind: 'sold', observedAt: iso(10), relevance: 1 },
      { priceCents: 9000, kind: 'sold', observedAt: iso(400), relevance: 0.2 }, // ancien et éloigné
    ],
    { now: NOW },
  );
  assert.equal(e.medianCents, 3100);
});

test('médiane pondérée : une valeur réellement observée, la plus basse en cas d\'égalité (prudence)', () => {
  assert.equal(weightedPercentile([{ value: 1000, weight: 1 }, { value: 2000, weight: 1 }], 0.5), 1000);
  assert.equal(weightedPercentile([{ value: 1000, weight: 1 }, { value: 2000, weight: 3 }], 0.5), 2000);
});

test('prix affichés seulement : estimation permise mais signalée et moins pesée', () => {
  const e = estimateResale([3000, 3100, 3200].map((p) => ({ priceCents: p, kind: 'asking' as const, observedAt: iso(2) })), { now: NOW });
  assert.equal(e.status, 'ok');
  assert.equal(e.basis, 'asking');
  assert.ok(e.warnings.length > 0);
  assert.ok(e.evidenceWeight < 3); // 3 prix affichés < 3 ventes réalisées
});

test('ancienneté du comparable le plus récent', () => {
  const e = estimateResale([3000, 3100, 3200].map((p, i) => ({ priceCents: p, kind: 'sold' as const, observedAt: iso(100 + i) })), { now: NOW });
  assert.equal(e.newestAgeDays, 100);
});
