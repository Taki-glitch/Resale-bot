
import test from 'node:test';
import assert from 'node:assert/strict';
import { scoreOpportunity } from './opportunity-score.ts';

test('plafonne le score si les preuves sont insuffisantes', () => {
  const result = scoreOpportunity({
    purchaseCents: 2000, resaleCents: 6000, soldComparables: 0, askingComparables: 1,
    confidence: 0.9, sufficientData: true, condition: 'Neuf', location: 'Nantes',
  });
  assert.equal(result.score <= 49, true);
  assert.equal(result.eligible, false);
  assert.equal(result.risk, 'high');
});

test('valorise les ventes réalisées et les données complètes', () => {
  const result = scoreOpportunity({
    purchaseCents: 2000, resaleCents: 5000, soldComparables: 4, askingComparables: 1,
    confidence: 0.95, sufficientData: true, condition: 'Très bon état', location: 'Nantes',
  });
  assert.equal(result.eligible, true);
  assert.equal(result.score >= 75, true);
  assert.equal(result.risk, 'low');
});

test('un achat sans marge ne devient pas une opportunité', () => {
  const result = scoreOpportunity({
    purchaseCents: 5000, resaleCents: 4500, soldComparables: 4, askingComparables: 0,
    confidence: 0.9, sufficientData: true, condition: 'Bon état', location: 'Nantes',
  });
  assert.equal(result.eligible, false);
  assert.equal(result.score <= 20, true);
});
