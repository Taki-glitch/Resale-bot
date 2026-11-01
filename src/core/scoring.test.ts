import test from 'node:test';
import assert from 'node:assert/strict';
import { computeScore, conditionFraction, DEFAULT_WEIGHTS, normalizeWeights } from './scoring.ts';
import type { ScoreInput } from './scoring.ts';

const base: ScoreInput = {
  netProfitCents: 2000,
  roiPct: 80,
  minProfitCents: 1000,
  minRoiPct: 40,
  soldCount: 5,
  recentSoldCount: 5,
  dispersion: 0.1,
  listing: { hasUrl: true, descriptionLength: 120, hasLocation: true },
  analysis: { present: true, sufficientData: true, confidence: 0.8, riskFlagCount: 0, visibleDefectCount: 0 },
  declaredCondition: 'Très bon état',
};

test('poids : total ramené à 100, défauts conservés', () => {
  const w = normalizeWeights({ margin: 60, demand: 60, resale: 0, reliability: 0, condition: 0, logistics: 0 });
  assert.equal(Math.round(w.margin + w.demand + w.resale + w.reliability + w.condition + w.logistics), 100);
  assert.equal(w.margin, 50);
  assert.deepEqual(normalizeWeights(), DEFAULT_WEIGHTS);
});

test('poids invalides ou tous à zéro : retour aux défauts', () => {
  const zero = { margin: 0, demand: 0, resale: 0, reliability: 0, condition: 0, logistics: 0 };
  assert.deepEqual(normalizeWeights(zero), DEFAULT_WEIGHTS);
  assert.equal(normalizeWeights({ margin: -5, demand: Number.NaN }).margin, normalizeWeights({ margin: 0 }).margin);
});

test('état déclaré reconnu sans tenir compte de la casse', () => {
  assert.equal(conditionFraction('TRÈS BON ÉTAT'), 0.8);
  assert.equal(conditionFraction('Inconnu'), null);
  assert.equal(conditionFraction(null), null);
});

test('un critère non mesuré rapporte 0 point et le score ne dépasse jamais les données disponibles', () => {
  const r = computeScore(base);
  const logistics = r.criteria.find((c) => c.key === 'logistics');
  assert.equal(logistics?.measured, false);
  assert.equal(logistics?.earned, 0);
  assert.ok(r.score <= 95);
});

test('demande non mesurée sous 3 ventes réalisées', () => {
  const r = computeScore({ ...base, soldCount: 2, recentSoldCount: 2 });
  const d = r.criteria.find((c) => c.key === 'demand');
  assert.equal(d?.measured, false);
  assert.equal(d?.earned, 0);
});

test('marge : 0 point si le bénéfice est négatif, moitié des points aux seuils exacts', () => {
  const neg = computeScore({ ...base, netProfitCents: -100, roiPct: -5 });
  assert.equal(neg.criteria[0].earned, 0);
  const exact = computeScore({ ...base, netProfitCents: 1000, roiPct: 40 });
  assert.equal(Math.round(exact.criteria[0].earned), 15);
});

test('signaux de risque et défauts réduisent la fiabilité et l\'état', () => {
  const clean = computeScore(base);
  const bad = computeScore({ ...base, analysis: { ...base.analysis, riskFlagCount: 2, visibleDefectCount: 2 } });
  assert.ok(bad.score < clean.score);
});

test('recalibrage : tout le poids sur la marge', () => {
  const r = computeScore(base, { margin: 100, demand: 0, resale: 0, reliability: 0, condition: 0, logistics: 0 });
  assert.equal(r.score, 100); // ratio >= 2 -> marge maximale
});
