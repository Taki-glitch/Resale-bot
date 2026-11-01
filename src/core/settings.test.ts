import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_SETTINGS, eurosToCents, mergeSettings } from './settings.ts';

test('réglages vides ou invalides : valeurs par défaut', () => {
  assert.deepEqual(mergeSettings(null), DEFAULT_SETTINGS);
  assert.deepEqual(mergeSettings('abc'), DEFAULT_SETTINGS);
});

test('réglages partiels fusionnés', () => {
  const s = mergeSettings({ minProfitCents: 1500 });
  assert.equal(s.minProfitCents, 1500);
  assert.equal(s.minRoiPct, DEFAULT_SETTINGS.minRoiPct);
});

test('conversion euros vers centimes sans erreur flottante', () => {
  assert.equal(eurosToCents(19.99), 1999);
  assert.equal(eurosToCents(0.1 + 0.2), 30);
});

test('réglages V0.3 : poids de scoring fusionnés, valeurs par défaut conservées', () => {
  const s = mergeSettings({ scoringWeights: { margin: 40 }, resalePlatform: 'leboncoin' });
  assert.equal(s.scoringWeights.margin, 40);
  assert.equal(s.scoringWeights.demand, DEFAULT_SETTINGS.scoringWeights.demand);
  assert.equal(s.resalePlatform, 'leboncoin');
  assert.equal(mergeSettings({}).defaultOtherCostsCents, 0);
});
