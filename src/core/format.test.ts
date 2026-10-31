import test from 'node:test';
import assert from 'node:assert/strict';
import { formatPct, parseEuros } from './format.ts';

test('parseEuros accepte virgule et point', () => {
  assert.equal(parseEuros('12,50'), 1250);
  assert.equal(parseEuros('19.99'), 1999);
  assert.equal(parseEuros(' 8 '), 800);
});

test('parseEuros refuse vide, négatif et texte', () => {
  assert.equal(parseEuros(''), null);
  assert.equal(parseEuros('-3'), null);
  assert.equal(parseEuros('abc'), null);
});

test('formatPct', () => {
  assert.equal(formatPct(null), '—');
  assert.match(formatPct(35.8), /35[.,]8/);
});
