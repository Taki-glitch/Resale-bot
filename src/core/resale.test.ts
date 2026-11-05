import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResaleDraft, suggestResalePrices } from './resale.ts';

const base = { acquisitionCostCents: 2500, fee: { percent: 5, fixedCents: 70 }, saleShippingCents: 0, minProfitCents: 1000 };

test('prix conseillé = estimation centrale quand elle dépasse le minimum acceptable', () => {
  const p = suggestResalePrices({ ...base, estimateMedianCents: 5000 });
  assert.equal(p.suggestedCents, 5000);
  assert.ok((p.minAcceptableCents ?? 0) > (p.breakEvenCents ?? 0));
});

test('marché sous le bénéfice minimum : le conseil est le minimum acceptable, avec avertissement', () => {
  const p = suggestResalePrices({ ...base, estimateMedianCents: 3000 });
  assert.equal(p.suggestedCents, p.minAcceptableCents);
  assert.match(p.note, /sous ton bénéfice minimum/);
});

test('sans estimation : aucun prix conseillé inventé, minimum acceptable calculé', () => {
  const p = suggestResalePrices({ ...base, estimateMedianCents: null });
  assert.equal(p.suggestedCents, null);
  assert.ok(p.minAcceptableCents !== null);
  assert.match(p.note, /Estimation indisponible/);
});

test('le minimum acceptable atteint bien le bénéfice minimum', () => {
  const p = suggestResalePrices({ ...base, estimateMedianCents: 5000 });
  const price = p.minAcceptableCents as number;
  const fees = Math.round((price * 5) / 100) + 70;
  assert.ok(price - fees - 2500 >= 1000);
  const below = price - 1;
  assert.ok(below - (Math.round((below * 5) / 100) + 70) - 2500 < 1000);
});

test('brouillon de revente : uniquement des informations saisies', () => {
  const d = buildResaleDraft({ name: 'Veste', brand: 'Moncler', model: 'Maya', category: 'Vestes', condition: 'Très bon état', accessories: 'housse', notes: null });
  assert.equal(d.title, 'Veste Moncler Maya');
  assert.match(d.description, /État : Très bon état\./);
  assert.match(d.description, /Accessoires inclus : housse\./);
  assert.ok(d.keywords.includes('moncler'));
  const bare = buildResaleDraft({ name: 'Sac' });
  assert.doesNotMatch(bare.description, /État :/);
  assert.doesNotMatch(bare.description, /Accessoires/);
});

test('le titre ne répète pas la marque déjà présente dans le nom', () => {
  assert.equal(buildResaleDraft({ name: 'Veste Moncler', brand: 'Moncler' }).title, 'Veste Moncler');
});
