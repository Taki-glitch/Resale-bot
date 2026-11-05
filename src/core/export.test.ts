import test from 'node:test';
import assert from 'node:assert/strict';
import { csvCell, euros, toCsv } from './export.ts';
import { addPhotoPath, isOwnPhotoPath, MAX_PHOTOS, photoPath } from './photos.ts';

test('CSV : échappement des séparateurs et des guillemets', () => {
  assert.equal(csvCell('a;b'), '"a;b"');
  assert.equal(csvCell('dit "ok"'), '"dit ""ok"""');
  assert.equal(csvCell(null), '');
});

test('CSV : neutralisation des formules, nombres négatifs conservés', () => {
  assert.equal(csvCell('=SOMME(A1:A2)'), "'=SOMME(A1:A2)");
  assert.equal(csvCell('+33612345678'), "'+33612345678");
  assert.equal(csvCell('@cmd'), "'@cmd");
  assert.equal(csvCell('-12,50'), '-12,50');
  assert.equal(csvCell(-5), '-5');
});

test('CSV complet : BOM, en-tête, lignes', () => {
  const csv = toCsv([{ n: 'Veste', p: 1250 }], [
    { label: 'Nom', value: (r) => r.n },
    { label: 'Prix (€)', value: (r) => euros(r.p) },
  ]);
  assert.ok(csv.startsWith('\ufeffNom;Prix (€)'));
  assert.ok(csv.endsWith('Veste;12,50'));
  assert.equal(euros(null), '');
});

test('photos : chemin par utilisateur, propriété et plafond', () => {
  const p = photoPath('u1', 'inv-9', 'abc');
  assert.equal(p, 'u1/inv-9/abc.jpg');
  assert.equal(isOwnPhotoPath(p, 'u1'), true);
  assert.equal(isOwnPhotoPath(p, 'u2'), false);
  assert.equal(isOwnPhotoPath('u1/../u2/x.jpg', 'u1'), false);
  assert.deepEqual(addPhotoPath(['a'], 'a'), ['a']);
  assert.equal(addPhotoPath(Array.from({ length: MAX_PHOTOS }, (_, i) => `p${i}`), 'new').length, MAX_PHOTOS);
});
