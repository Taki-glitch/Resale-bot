import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FILTERS, filterOpportunities, shouldNotifyOpportunity, sortOpportunities } from './opportunities.ts';
import type { OpportunityView } from './opportunities.ts';

const o = (id: string, over: Partial<OpportunityView> = {}): OpportunityView => ({
  id,
  listingId: `l-${id}`,
  title: `Annonce ${id}`,
  platform: 'vinted',
  category: 'Vestes',
  priceCents: 2000,
  resaleEstimateCents: 4000,
  netProfitCents: 1000,
  netMarginPct: 25,
  maxBuyCents: 2500,
  score: 70,
  recommendation: 'good',
  riskLevel: 'medium',
  confidence: 0.6,
  status: 'new',
  isSelected: false,
  detectedAt: '2026-11-01T00:00:00Z',
  ...over,
});

const rows = [
  o('a', { score: 90, netProfitCents: 800, netMarginPct: 20, riskLevel: 'high' }),
  o('b', { score: 60, netProfitCents: 2000, netMarginPct: 40, riskLevel: 'low', platform: 'leboncoin', category: 'Chaussures' }),
  o('c', { score: null, netProfitCents: null, netMarginPct: null, riskLevel: null, recommendation: 'insufficient' }),
  o('d', { score: 75, netProfitCents: 1500, netMarginPct: 30, riskLevel: 'medium', status: 'rejected', isSelected: true }),
];

test('tri par score : meilleurs d\'abord, valeurs manquantes à la fin', () => {
  assert.deepEqual(sortOpportunities(rows, 'score').map((r) => r.id), ['a', 'd', 'b', 'c']);
});

test('tri par bénéfice, marge et risque le plus faible', () => {
  assert.deepEqual(sortOpportunities(rows, 'profit').map((r) => r.id), ['b', 'd', 'a', 'c']);
  assert.deepEqual(sortOpportunities(rows, 'margin').map((r) => r.id), ['b', 'd', 'a', 'c']);
  assert.deepEqual(sortOpportunities(rows, 'risk').map((r) => r.id), ['b', 'd', 'a', 'c']);
});

test('filtres par défaut : actives et évaluables seulement', () => {
  assert.deepEqual(filterOpportunities(rows, DEFAULT_FILTERS).map((r) => r.id), ['a', 'b']);
});

test('historique et non évaluables', () => {
  const all = filterOpportunities(rows, { ...DEFAULT_FILTERS, status: 'all', includeUnevaluable: true });
  assert.equal(all.length, 4);
  assert.deepEqual(filterOpportunities(rows, { ...DEFAULT_FILTERS, status: 'rejected' }).map((r) => r.id), ['d']);
});

test('filtres plateforme, catégorie, budget et bénéfice', () => {
  assert.deepEqual(filterOpportunities(rows, { ...DEFAULT_FILTERS, platform: 'leboncoin' }).map((r) => r.id), ['b']);
  assert.deepEqual(filterOpportunities(rows, { ...DEFAULT_FILTERS, category: 'Chaussures' }).map((r) => r.id), ['b']);
  assert.deepEqual(filterOpportunities(rows, { ...DEFAULT_FILTERS, maxBudgetCents: 1500 }).map((r) => r.id), []);
  assert.deepEqual(filterOpportunities(rows, { ...DEFAULT_FILTERS, minProfitCents: 1000 }).map((r) => r.id), ['b']);
});

test('sélection personnelle', () => {
  const sel = filterOpportunities(rows, { ...DEFAULT_FILTERS, status: 'all', selectedOnly: true });
  assert.deepEqual(sel.map((r) => r.id), ['d']);
});

test('notification : seulement au passage vers bonne ou excellente affaire, au-dessus du seuil', () => {
  assert.equal(shouldNotifyOpportunity(null, 'good', 1200, 1000), true);
  assert.equal(shouldNotifyOpportunity('conditional', 'excellent', 1200, 1000), true);
  assert.equal(shouldNotifyOpportunity('good', 'excellent', 1500, 1000), false); // déjà notifiée
  assert.equal(shouldNotifyOpportunity(null, 'good', 900, 1000), false); // sous le seuil
  assert.equal(shouldNotifyOpportunity(null, 'conditional', 5000, 1000), false);
  assert.equal(shouldNotifyOpportunity(null, 'good', null, 1000), false);
});
