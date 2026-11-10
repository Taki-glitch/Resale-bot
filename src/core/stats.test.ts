import test from 'node:test';
import assert from 'node:assert/strict';
import { addMonths, agingBuckets, capitalUsage, funnelRates, monthlySeries, objectiveProgress, sellingCostsCents } from './stats.ts';
import type { InventoryItemView, SaleView } from './inventory.ts';

const sale = (id: string, soldAt: string, over: Partial<SaleView> = {}): SaleView => ({
  id, inventoryId: `i${id}`, name: id, soldAt, priceCents: 5000, platform: 'vinted', category: 'Vestes',
  feesCents: 250, shippingCents: 400, extraCostsCents: 100, acquisitionCostCents: 2500, plannedPriceCents: null, daysToSell: 10, ...over,
});
const item = (id: string, over: Partial<InventoryItemView> = {}): InventoryItemView => ({
  id, name: id, status: 'in_stock', category: null, purchasePriceCents: 2000, purchaseFeesCents: 0, expensesCents: 0,
  plannedPriceCents: null, purchasedAt: null, inStockSince: null, platform: null, ...over,
});

test('arithmétique des mois, y compris le passage d\'année', () => {
  assert.equal(addMonths('2026-01', -1), '2025-12');
  assert.equal(addMonths('2026-11', 2), '2027-01');
});

test('série mensuelle : mois vides à zéro, cumul, ventes au coût inconnu hors bénéfice', () => {
  const s = monthlySeries(
    [sale('a', '2026-09-10T00:00:00Z'), sale('b', '2026-11-02T00:00:00Z'), sale('c', '2026-11-20T00:00:00Z', { acquisitionCostCents: null }), sale('old', '2024-01-01T00:00:00Z')],
    '2026-11',
    4,
  );
  assert.deepEqual(s.map((p) => p.month), ['2026-08', '2026-09', '2026-10', '2026-11']);
  assert.equal(s[0].salesCount, 0);
  assert.equal(s[1].netProfitCents, 1750);
  assert.equal(s[3].salesCount, 2);
  assert.equal(s[3].revenueCents, 10000);
  assert.equal(s[3].netProfitCents, 1750); // la vente au coût inconnu n'ajoute pas de bénéfice
  assert.equal(s[3].cumulativeProfitCents, 3500);
});

test('entonnoir : taux calculés, null si dénominateur nul', () => {
  const r = funnelRates({ listings: 20, evaluated: 10, recommended: 4, bought: 2, sold: 1 });
  assert.equal(r.evaluatedPct, 50);
  assert.equal(r.recommendedPct, 40);
  assert.equal(r.boughtPct, 10);
  assert.equal(r.soldPct, 50);
  assert.equal(funnelRates({ listings: 0, evaluated: 0, recommended: 0, bought: 0, sold: 0 }).evaluatedPct, null);
});

test('stock par ancienneté', () => {
  const now = new Date('2026-11-30T00:00:00Z');
  const b = agingBuckets(
    [
      item('a', { purchasedAt: '2026-11-20T00:00:00Z' }),
      item('b', { purchasedAt: '2026-10-10T00:00:00Z' }),
      item('c', { purchasedAt: '2026-09-15T00:00:00Z' }),
      item('d', { purchasedAt: '2026-05-01T00:00:00Z' }),
      item('e'),
      item('sold', { status: 'sold', purchasedAt: '2026-05-01T00:00:00Z' }),
    ],
    now,
  );
  assert.deepEqual(b.map((x) => x.count), [1, 1, 1, 1, 1]);
  assert.equal(b[3].costCents, 2000);
});

test('objectif mensuel et capital engagé', () => {
  assert.deepEqual(objectiveProgress(15000, 30000), { pct: 50, remainingCents: 15000 });
  assert.deepEqual(objectiveProgress(40000, 30000), { pct: 133, remainingCents: 0 });
  assert.equal(objectiveProgress(100, 0).pct, null);
  assert.deepEqual(capitalUsage(20000, 5000), { engagedCents: 5000, availableCents: 15000, usedPct: 25 });
});

test('frais de vente totaux', () => {
  assert.equal(sellingCostsCents([sale('a', '2026-11-01T00:00:00Z'), sale('b', '2026-11-02T00:00:00Z')]), 1500);
});
