import test from 'node:test';
import assert from 'node:assert/strict';
import { agedItems, filterInventory, itemCostCents, realizedProfitCents, stockSummary, summarizeSales } from './inventory.ts';
import type { InventoryItemView, SaleView } from './inventory.ts';

const item = (id: string, over: Partial<InventoryItemView> = {}): InventoryItemView => ({
  id,
  name: `Article ${id}`,
  status: 'in_stock',
  category: 'Vestes',
  purchasePriceCents: 2000,
  purchaseFeesCents: 300,
  expensesCents: 200,
  plannedPriceCents: 4000,
  purchasedAt: '2026-10-01T00:00:00Z',
  inStockSince: null,
  platform: 'vinted',
  ...over,
});

test('coût d\'un article : achat + frais + dépenses ; inconnu si l\'achat est inconnu', () => {
  assert.equal(itemCostCents(item('a')), 2500);
  assert.equal(itemCostCents(item('b', { purchasePriceCents: null })), null);
});

test('valeur du stock : seulement les articles possédés et non vendus ; coûts inconnus comptés à part', () => {
  const s = stockSummary([
    item('a'),
    item('b', { status: 'sold' }),
    item('c', { status: 'cancelled' }),
    item('d', { purchasePriceCents: null, plannedPriceCents: null }),
    item('e', { status: 'listed', plannedPriceCents: 3000 }),
  ]);
  assert.equal(s.count, 3);
  assert.equal(s.costCents, 5000);
  assert.equal(s.unknownCostCount, 1);
  assert.equal(s.plannedValueCents, 7000);
  assert.equal(s.unplannedCount, 1);
});

test('stock immobilisé depuis plus de 60 jours', () => {
  const now = new Date('2026-11-30T00:00:00Z');
  const old = item('old', { purchasedAt: '2026-08-01T00:00:00Z' });
  const recent = item('recent', { purchasedAt: '2026-11-20T00:00:00Z' });
  const sold = item('sold', { status: 'sold', purchasedAt: '2026-08-01T00:00:00Z' });
  assert.deepEqual(agedItems([old, recent, sold], now).map((i) => i.id), ['old']);
  assert.deepEqual(agedItems([item('s', { inStockSince: '2026-11-25T00:00:00Z', purchasedAt: '2026-08-01T00:00:00Z' })], now), []);
});

test('recherche dans l\'inventaire', () => {
  const rows = [item('a', { name: 'Veste Moncler' }), item('b', { name: 'Sac', status: 'listed' })];
  assert.deepEqual(filterInventory(rows, { query: 'moncler', status: '' }).map((i) => i.id), ['a']);
  assert.deepEqual(filterInventory(rows, { query: '', status: 'listed' }).map((i) => i.id), ['b']);
});

test('bénéfice réalisé : toutes les charges déduites ; inconnu si le coût d\'achat est inconnu', () => {
  assert.equal(realizedProfitCents({ priceCents: 5000, feesCents: 250, shippingCents: 400, extraCostsCents: 100, acquisitionCostCents: 2500 }), 1750);
  assert.equal(realizedProfitCents({ priceCents: 5000, feesCents: 0, shippingCents: 0, extraCostsCents: 0, acquisitionCostCents: null }), null);
});

const sale = (id: string, over: Partial<SaleView> = {}): SaleView => ({
  id,
  inventoryId: `i-${id}`,
  name: `Vente ${id}`,
  soldAt: '2026-11-10T00:00:00Z',
  priceCents: 5000,
  platform: 'vinted',
  category: 'Vestes',
  feesCents: 250,
  shippingCents: 400,
  extraCostsCents: 100,
  acquisitionCostCents: 2500,
  plannedPriceCents: 4500,
  daysToSell: 20,
  ...over,
});

test('synthèse des ventes : chiffre d\'affaires, bénéfice, marge, prévu contre réalisé', () => {
  const s = summarizeSales([sale('a'), sale('b', { priceCents: 3000, acquisitionCostCents: 2000, platform: 'leboncoin', category: 'Sacs', plannedPriceCents: null, daysToSell: 40 })]);
  assert.equal(s.count, 2);
  assert.equal(s.revenueCents, 8000);
  assert.equal(s.netProfitCents, 1750 + (3000 - 250 - 400 - 100 - 2000)); // 1750 + 250
  assert.equal(s.acquisitionCostCents, 4500);
  assert.equal(s.averageDaysToSell, 30);
  assert.equal(s.plannedVsRealized.count, 1);
  assert.equal(s.plannedVsRealized.plannedCents, 4500);
  assert.equal(s.plannedVsRealized.realizedCents, 5000);
  assert.deepEqual(s.byPlatform.map((g) => g.key), ['vinted', 'leboncoin']);
  assert.equal(s.byCategory.length, 2);
});

test('une vente au coût d\'achat inconnu compte dans le chiffre d\'affaires mais pas dans le bénéfice', () => {
  const s = summarizeSales([sale('a'), sale('b', { acquisitionCostCents: null })]);
  assert.equal(s.revenueCents, 10000);
  assert.equal(s.netProfitCents, 1750);
  assert.equal(s.unknownCostCount, 1);
});

test('aucune vente : tout à zéro, marge inconnue', () => {
  const s = summarizeSales([]);
  assert.equal(s.count, 0);
  assert.equal(s.averageMarginPct, null);
  assert.equal(s.averageDaysToSell, null);
});
