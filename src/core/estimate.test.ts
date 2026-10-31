import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateResale } from './estimate.ts';

const sold = (priceCents: number) => ({ priceCents, kind: 'sold' as const });
const asking = (priceCents: number) => ({ priceCents, kind: 'asking' as const });

test('moins de 3 comparables : estimation insuffisamment documentée', () => {
  const e = estimateResale([sold(3000), asking(3500)]);
  assert.equal(e.status, 'insufficient');
  assert.equal(e.medianCents, null);
  assert.match(e.warnings[0], /insuffisamment documentée/);
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
