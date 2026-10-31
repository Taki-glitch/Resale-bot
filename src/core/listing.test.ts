import test from 'node:test';
import assert from 'node:assert/strict';
import { fingerprint, normalizeUrl, parseListingUrl } from './listing.ts';

test('URL normalisée : sans www, paramètres ni slash final', () => {
  assert.equal(normalizeUrl('https://www.Vinted.fr/items/123-veste/?utm=1#x'), 'vinted.fr/items/123-veste');
  assert.equal(normalizeUrl('pas une url'), null);
  assert.equal(normalizeUrl('ftp://exemple.fr/a'), null);
});

test('Vinted : plateforme et identifiant reconnus', () => {
  const p = parseListingUrl('https://www.vinted.fr/items/4567890-nike-air-max');
  assert.equal(p?.platform, 'vinted');
  assert.equal(p?.externalId, '4567890');
});

test('Leboncoin : formats /ad/categorie/id et .htm', () => {
  assert.equal(parseListingUrl('https://www.leboncoin.fr/ad/sports_hobbies/2987654321')?.externalId, '2987654321');
  assert.equal(parseListingUrl('https://www.leboncoin.fr/vi/1234567.htm')?.externalId, '1234567');
  assert.equal(parseListingUrl('https://www.leboncoin.fr/ad/sports_hobbies/2987654321')?.platform, 'leboncoin');
});

test('site inconnu : plateforme "other", pas d\'identifiant', () => {
  const p = parseListingUrl('https://exemple.com/annonce/42');
  assert.equal(p?.platform, 'other');
  assert.equal(p?.externalId, null);
});

test('doublon : même annonce Vinted malgré slug et paramètres différents', () => {
  const a = fingerprint({ url: 'https://www.vinted.fr/items/4567890-nike-air-max?x=1', title: 'A', priceCents: 1000 });
  const b = fingerprint({ url: 'https://vinted.fr/items/4567890-autre-slug', title: 'B', priceCents: 2000 });
  assert.equal(a, b);
});

test('sans URL : titre normalisé (accents, ponctuation) + prix', () => {
  const a = fingerprint({ title: 'Véste  Nike - L!', priceCents: 1500 });
  const b = fingerprint({ title: 'veste nike l', priceCents: 1500 });
  assert.equal(a, b);
  assert.notEqual(a, fingerprint({ title: 'veste nike l', priceCents: 1600 }));
});
