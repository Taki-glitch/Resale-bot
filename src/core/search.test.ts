import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_CRITERIA, filterListings, parseSavedSearch, serializeSearch, sortListings } from './search.ts';
import type { SearchableListing } from './search.ts';

const L = (id: string, over: Partial<SearchableListing> = {}): SearchableListing => ({
  id,
  title: `Annonce ${id}`,
  platform: 'vinted',
  location: 'Lyon',
  priceCents: 2000,
  brand: 'Nike',
  model: 'Air Max',
  category: 'Chaussures',
  detectedAt: '2026-11-01T10:00:00Z',
  score: 70,
  netProfitCents: 1500,
  netMarginPct: 30,
  confidenceLevel: 'medium',
  status: 'new',
  recommendation: 'good',
  ...over,
});

const rows = [
  L('a', { title: 'Veste Moncler bleue', brand: 'Moncler', model: 'Maya', category: 'Vestes', score: 85, netProfitCents: 4000, netMarginPct: 40, confidenceLevel: 'high', detectedAt: '2026-11-03T00:00:00Z' }),
  L('b', { platform: 'leboncoin', priceCents: 800, score: 55, netProfitCents: 500, netMarginPct: 15, confidenceLevel: 'low', detectedAt: '2026-10-20T00:00:00Z', status: 'rejected' }),
  L('c', { score: null, netProfitCents: null, netMarginPct: null, confidenceLevel: null, status: null, recommendation: null, detectedAt: '2026-11-02T00:00:00Z' }),
];
const ids = (r: SearchableListing[]) => r.map((x) => x.id);

test('sans critère : tout est affiché', () => {
  assert.deepEqual(ids(filterListings(rows, EMPTY_CRITERIA)), ['a', 'b', 'c']);
});

test('mot-clé insensible à la casse et aux accents, tous les mots requis', () => {
  assert.deepEqual(ids(filterListings(rows, { ...EMPTY_CRITERIA, keyword: 'VESTE bleue' })), ['a']);
  assert.deepEqual(ids(filterListings(rows, { ...EMPTY_CRITERIA, keyword: 'air  max' })), ['b', 'c']);
  assert.deepEqual(ids(filterListings(rows, { ...EMPTY_CRITERIA, keyword: 'lyon veste' })), ['a']);
});

test('filtres plateforme, catégorie, marque et prix d\'achat', () => {
  assert.deepEqual(ids(filterListings(rows, { ...EMPTY_CRITERIA, platform: 'leboncoin' })), ['b']);
  assert.deepEqual(ids(filterListings(rows, { ...EMPTY_CRITERIA, category: 'Vestes' })), ['a']);
  assert.deepEqual(ids(filterListings(rows, { ...EMPTY_CRITERIA, brand: 'moncl' })), ['a']);
  assert.deepEqual(ids(filterListings(rows, { ...EMPTY_CRITERIA, maxPriceCents: 1000 })), ['b']);
});

test('filtres bénéfice, marge, score et confiance : les annonces non évaluées sont exclues', () => {
  assert.deepEqual(ids(filterListings(rows, { ...EMPTY_CRITERIA, minProfitCents: 1000 })), ['a']);
  assert.deepEqual(ids(filterListings(rows, { ...EMPTY_CRITERIA, minMarginPct: 10 })), ['a', 'b']);
  assert.deepEqual(ids(filterListings(rows, { ...EMPTY_CRITERIA, minScore: 60 })), ['a']);
  assert.deepEqual(ids(filterListings(rows, { ...EMPTY_CRITERIA, confidence: 'low' })), ['b']);
});

test('filtre par statut et annonces non évaluées', () => {
  assert.deepEqual(ids(filterListings(rows, { ...EMPTY_CRITERIA, status: 'rejected' })), ['b']);
  assert.deepEqual(ids(filterListings(rows, { ...EMPTY_CRITERIA, status: 'unevaluated' })), ['c']);
});

test('tris : rentabilité, score, marge et date ; valeurs manquantes en dernier', () => {
  assert.deepEqual(ids(sortListings(rows, 'profit')), ['a', 'b', 'c']);
  assert.deepEqual(ids(sortListings(rows, 'score')), ['a', 'b', 'c']);
  assert.deepEqual(ids(sortListings(rows, 'margin')), ['a', 'b', 'c']);
  assert.deepEqual(ids(sortListings(rows, 'date')), ['a', 'c', 'b']);
});

test('enregistrement puis relecture d\'une recherche (aller-retour)', () => {
  const criteria = { ...EMPTY_CRITERIA, keyword: 'veste', maxPriceCents: 5000, minScore: 65, confidence: 'high' as const };
  const back = parseSavedSearch(serializeSearch(criteria, 'score'));
  assert.deepEqual(back.criteria, criteria);
  assert.equal(back.sort, 'score');
});

test('anciennes recherches enregistrées (prix en euros, plateforme « all ») toujours lisibles', () => {
  const back = parseSavedSearch({ keyword: 'sac', platform: 'all', category: 'Sacs', location: 'Paris', maxPrice: '25,50' });
  assert.equal(back.criteria.platform, '');
  assert.equal(back.criteria.maxPriceCents, 2550);
  assert.equal(back.criteria.keyword, 'sac');
  assert.equal(back.sort, 'date');
  assert.deepEqual(parseSavedSearch(null).criteria, EMPTY_CRITERIA);
});
