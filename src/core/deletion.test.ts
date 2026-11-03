import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldDeleteProduct } from './deletion.ts';

test('le produit est supprimé seulement s\'il n\'est plus utilisé', () => {
  assert.equal(shouldDeleteProduct({ listings: 0, inventoryItems: 0 }), true);
});

test('un produit encore utilisé par une autre annonce est conservé', () => {
  assert.equal(shouldDeleteProduct({ listings: 1, inventoryItems: 0 }), false);
});

test('un produit présent en inventaire est conservé', () => {
  assert.equal(shouldDeleteProduct({ listings: 0, inventoryItems: 2 }), false);
});
