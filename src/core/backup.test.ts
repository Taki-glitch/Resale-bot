import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareRestore, RESTORE_ORDER, validateBackup } from './backup.ts';

const backup = (tables: Record<string, Record<string, unknown>[]>) => ({ app: 'resale-bot', version: '0.5.0', exportedAt: '2026-11-01', settings: {}, tables });

test('sauvegarde invalide refusée avec un message clair', () => {
  assert.equal(validateBackup(null).ok, false);
  assert.equal(validateBackup({ app: 'autre', tables: {} }).ok, false);
  assert.equal(validateBackup({ app: 'resale-bot' }).ok, false);
  assert.equal(validateBackup(backup({})).ok, false);
  const r = validateBackup(backup({ products: [{ name: 'sans identifiant' }] }));
  assert.equal(r.ok, false);
});

test('sauvegarde valide : comptage par table, tables inconnues ignorées', () => {
  const r = validateBackup(backup({ products: [{ id: 'p1' }], inconnue: [{ id: 'x' }] }));
  assert.ok(r.ok);
  assert.deepEqual(r.counts, { products: 1 });
});

test('l\'ordre de restauration place chaque parent avant ses enfants', () => {
  const pos = (t: string) => RESTORE_ORDER.indexOf(t as (typeof RESTORE_ORDER)[number]);
  const pairs: [string, string][] = [
    ['products', 'listings'], ['search_configs', 'listings'], ['listings', 'analyses'], ['analyses', 'comparables'],
    ['listings', 'opportunities'], ['opportunities', 'purchases'], ['purchases', 'inventory'], ['inventory', 'resales'],
    ['inventory', 'sales'], ['resales', 'sales'], ['inventory', 'expenses'], ['listings', 'notifications'],
  ];
  for (const [parent, child] of pairs) assert.ok(pos(parent) < pos(child), `${parent} doit précéder ${child}`);
});

test('restauration : identifiants conservés et propriétaire forcé', () => {
  const v = validateBackup(
    backup({ products: [{ id: 'p1', user_id: 'ancien', name: 'A' }], listings: [{ id: 'l1', user_id: 'ancien', product_id: 'p1', title: 'T' }] }),
  );
  assert.ok(v.ok);
  const p = prepareRestore(v.backup, 'nouveau');
  assert.equal(p.tables.products[0].id, 'p1');
  assert.equal(p.tables.products[0].user_id, 'nouveau');
  assert.equal(p.tables.listings[0].product_id, 'p1');
  assert.deepEqual(p.dropped, {});
});

test('références absentes : facultatives neutralisées, obligatoires écartées', () => {
  const v = validateBackup(
    backup({
      listings: [{ id: 'l1', product_id: 'inconnu', source_id: 'src' }],
      analyses: [{ id: 'a1', listing_id: 'l1' }, { id: 'a2', listing_id: 'absent' }],
      notifications: [{ id: 'n1', listing_id: 'absent' }],
    }),
  );
  assert.ok(v.ok);
  const p = prepareRestore(v.backup, 'u');
  assert.equal(p.tables.listings[0].product_id, null);
  assert.equal(p.tables.listings[0].source_id, null);
  assert.equal(p.tables.analyses.length, 1);
  assert.equal(p.dropped.analyses, 1);
  assert.equal(p.tables.notifications[0].listing_id, null);
  assert.equal(p.nulled['listings.product_id'], 1);
});

test('restauration rejouable : deux préparations successives donnent le même résultat', () => {
  const v = validateBackup(backup({ products: [{ id: 'p1', name: 'A' }] }));
  assert.ok(v.ok);
  assert.deepEqual(prepareRestore(v.backup, 'u'), prepareRestore(v.backup, 'u'));
});
