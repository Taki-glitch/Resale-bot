import test from 'node:test';
import assert from 'node:assert/strict';
import { detectEvents, shortHash } from './notifications.ts';
import type { NextState, PreviousState } from './notifications.ts';

const next = (over: Partial<NextState> = {}): NextState => ({
  recommendation: 'good',
  score: 70,
  risks: [],
  netProfitCents: 1500,
  priceCents: 2000,
  maxBuyCents: 2500,
  staleComparables: false,
  ...over,
});
const prev = (over: Partial<PreviousState> = {}): PreviousState => ({ recommendation: 'conditional', score: 55, risks: [], ...over });
const run = (p: PreviousState | null, n: NextState) =>
  detectEvents({ listingId: 'L1', listingTitle: 'Veste', previous: p, next: n, minProfitCents: 1000, now: new Date('2026-11-15T00:00:00Z') });
const types = (p: PreviousState | null, n: NextState) => run(p, n).map((e) => e.type).sort();

test('rien ne change : aucune notification', () => {
  assert.deepEqual(types(prev({ recommendation: 'good', score: 70 }), next()), []);
});

test('passage vers une bonne affaire au-dessus du seuil : une seule notification « opportunité »', () => {
  const t = types(prev(), next());
  assert.ok(t.includes('opportunity'));
  assert.ok(!t.includes('recommendation_changed')); // pas de doublon pour le même changement
});

test('devient évaluable', () => {
  const t = types(prev({ recommendation: 'insufficient', score: null }), next({ recommendation: 'conditional', score: 55, netProfitCents: 500 }));
  assert.deepEqual(t, ['became_evaluable']);
});

test('devient non évaluable', () => {
  const t = types(prev({ recommendation: 'good', score: 70 }), next({ recommendation: 'insufficient', score: null, netProfitCents: null }));
  assert.deepEqual(t, ['became_unevaluable']);
});

test('changement de recommandation sans opportunité chaude', () => {
  const t = types(prev({ recommendation: 'conditional', score: 55 }), next({ recommendation: 'avoid', score: 20, netProfitCents: -100 }));
  assert.ok(t.includes('recommendation_changed'));
});

test('score qui monte de tranche', () => {
  const t = types(prev({ recommendation: 'conditional', score: 55 }), next({ recommendation: 'conditional', score: 66, netProfitCents: 500 }));
  assert.ok(t.includes('score_band_up'));
});

test('nouveau risque seulement s\'il est réellement nouveau', () => {
  const p = prev({ recommendation: 'good', score: 70, risks: ['A'] });
  assert.deepEqual(types(p, next({ risks: ['A'] })), []);
  const e = run(p, next({ risks: ['A', 'B'] })).find((x) => x.type === 'new_risk');
  assert.ok(e);
  assert.equal(e.body, 'B');
});

test('comparables anciens sur une bonne affaire : réévaluation nécessaire, une fois par mois', () => {
  const e = run(prev({ recommendation: 'good', score: 70 }), next({ staleComparables: true })).find((x) => x.type === 'reevaluation_needed');
  assert.ok(e);
  assert.equal(e.dedupKey, 'stale:L1:2026-11');
});

test('clés de déduplication stables', () => {
  const a = run(prev(), next()).map((e) => e.dedupKey);
  const b = run(prev(), next()).map((e) => e.dedupKey);
  assert.deepEqual(a, b);
  assert.equal(shortHash(['x', 'y']), shortHash(['x', 'y']));
  assert.notEqual(shortHash(['x']), shortHash(['y']));
});

test('première évaluation sans bonne affaire : silence', () => {
  assert.deepEqual(types(null, next({ recommendation: 'poor', score: 40, netProfitCents: 300 })), []);
});
