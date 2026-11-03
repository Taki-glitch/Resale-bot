import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeFees,
  computeProfit,
  computeScenarios,
  maxPurchasePrice,
  minResalePrice,
} from './profitability.ts';

const fee5 = { percent: 5, fixedCents: 70 }; // 5 % + 0,70 €

test('frais : pourcentage + fixe, arrondi au centime', () => {
  assert.equal(computeFees(4000, fee5), 270);
  assert.equal(computeFees(0, fee5), 0);
  assert.equal(computeFees(4000, { percent: 0, fixedCents: 0 }), 0);
});

test('bénéfice net, marge et rendement', () => {
  const r = computeProfit({
    salePriceCents: 4000,
    purchasePriceCents: 2000,
    fee: fee5,
    otherCostsCents: 300,
  });
  assert.equal(r.grossProfitCents, 2000);
  assert.equal(r.feesCents, 270);
  assert.equal(r.netProfitCents, 1430); // 4000 - 2000 - 270 - 300
  assert.equal(r.marginPct, 35.8); // 1430 / 4000
  assert.equal(r.roiPct, 62.2); // 1430 / (2000 + 300)
});

test('perte : bénéfice négatif et pourcentages négatifs', () => {
  const r = computeProfit({ salePriceCents: 1000, purchasePriceCents: 1500, fee: fee5 });
  assert.ok(r.netProfitCents < 0);
  assert.ok((r.roiPct ?? 0) < 0);
});

test('prix de vente ou achat à zéro : pas de division par zéro', () => {
  const r = computeProfit({ salePriceCents: 0, purchasePriceCents: 0, fee: fee5 });
  assert.equal(r.marginPct, null);
  assert.equal(r.roiPct, null);
});

test("prix d'achat maximal", () => {
  const max = maxPurchasePrice({
    salePriceCents: 4000,
    fee: fee5,
    otherCostsCents: 300,
    minProfitCents: 1000,
  });
  assert.equal(max, 2430); // 4000 - 270 - 300 - 1000
  // Cohérence : acheter à ce prix donne exactement le bénéfice minimum.
  const r = computeProfit({
    salePriceCents: 4000,
    purchasePriceCents: max,
    fee: fee5,
    otherCostsCents: 300,
  });
  assert.equal(r.netProfitCents, 1000);
});

test("prix d'achat maximal jamais négatif", () => {
  assert.equal(maxPurchasePrice({ salePriceCents: 500, fee: fee5, minProfitCents: 1500 }), 0);
});

test('prix de revente minimum atteint bien le bénéfice minimum', () => {
  const args = { purchasePriceCents: 2000, fee: fee5, otherCostsCents: 300, minProfitCents: 1000 };
  const price = minResalePrice(args);
  assert.ok(price !== null);
  assert.ok(computeProfit({ ...args, salePriceCents: price }).netProfitCents >= 1000);
  // Et un centime de moins ne suffit pas.
  assert.ok(computeProfit({ ...args, salePriceCents: price - 1 }).netProfitCents < 1000);
});

test('frais à 100 % : pas de prix de revente possible', () => {
  assert.equal(
    minResalePrice({
      purchasePriceCents: 1000,
      fee: { percent: 100, fixedCents: 0 },
      minProfitCents: 100,
    }),
    null,
  );
});

test('trois scénarios ordonnés', () => {
  const s = computeScenarios({ salePriceCents: 4000, purchasePriceCents: 2000, fee: fee5 });
  assert.ok(s.optimistic.netProfitCents > s.realistic.netProfitCents);
  assert.ok(s.realistic.netProfitCents > s.cautious.netProfitCents);
  assert.equal(s.realistic.salePriceCents, 4000);
});

// ---- Détail des coûts (V0.3 consolidée) ----
import { acquisitionCost, computeScenarioSet } from './profitability.ts';

test('coûts détaillés : acquisition = achat + livraison + remise en état + autres ; rien n\'est compté deux fois', () => {
  const costs = { purchaseShippingCents: 400, cleaningCents: 250, otherCostsCents: 100, saleShippingCents: 500 };
  const r = computeProfit({ salePriceCents: 5000, purchasePriceCents: 2000, fee: { percent: 10, fixedCents: 0 }, ...costs });
  assert.equal(r.acquisitionCostCents, 2000 + 400 + 250 + 100);
  assert.equal(r.feesCents, 500);
  assert.equal(r.saleShippingCents, 500);
  assert.equal(r.totalCostCents, 2750 + 500 + 500);
  assert.equal(r.netProfitCents, 5000 - 500 - 500 - 2750); // 1250
  assert.equal(r.roiPct, 45.5); // 1250 / 2750
  assert.equal(r.marginPct, 25); // 1250 / 5000
  assert.equal(acquisitionCost({ purchasePriceCents: 100, purchaseShippingCents: -50 }), 100); // valeurs négatives ignorées
});

test('prix d\'achat maximal et prix de revente minimum tiennent compte de tous les coûts', () => {
  const args = { fee: { percent: 10, fixedCents: 0 }, purchaseShippingCents: 400, cleaningCents: 250, otherCostsCents: 100, saleShippingCents: 500 };
  const max = maxPurchasePrice({ salePriceCents: 5000, minProfitCents: 1000, ...args });
  assert.equal(max, 5000 - 500 - 500 - 400 - 250 - 100 - 1000); // 2250
  const r = computeProfit({ salePriceCents: 5000, purchasePriceCents: max, ...args });
  assert.equal(r.netProfitCents, 1000);
  const equilibre = minResalePrice({ purchasePriceCents: 2000, minProfitCents: 0, ...args });
  assert.ok(equilibre !== null);
  assert.ok(computeProfit({ salePriceCents: equilibre, purchasePriceCents: 2000, ...args }).netProfitCents >= 0);
  assert.ok(computeProfit({ salePriceCents: equilibre - 1, purchasePriceCents: 2000, ...args }).netProfitCents < 0);
});

test('jeu de scénarios : optimiste absent quand rien ne le justifie', () => {
  const base = { purchasePriceCents: 2000, fee: { percent: 0, fixedCents: 0 } };
  const s = computeScenarioSet(base, { prudentCents: 3000, centralCents: 4000, optimisticCents: null });
  assert.equal(s.optimistic, null);
  assert.ok(s.prudent.netProfitCents < s.central.netProfitCents);
});
