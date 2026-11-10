import test from 'node:test';
import assert from 'node:assert/strict';
import { withRetry } from './retry.ts';
import { formatTelegramMessage, isValidChatId, shouldSendTelegram } from './telegram.ts';
import { priceChange } from './price.ts';
import { buildOpportunityPayload } from './opportunity-payload.ts';
import { evaluateListing } from './evaluation.ts';

test('nouvelle tentative : réussit après des échecs, attentes exponentielles', async () => {
  const waits: number[] = [];
  let calls = 0;
  const r = await withRetry(
    async () => {
      calls += 1;
      if (calls < 3) throw new Error('réseau');
      return 'ok';
    },
    { retries: 3, baseMs: 100, sleep: async (ms) => void waits.push(ms) },
  );
  assert.equal(r, 'ok');
  assert.deepEqual(waits, [100, 200]);
});

test('nouvelle tentative : abandon après le nombre maximal, ou si l\'erreur n\'est pas réessayable', async () => {
  let calls = 0;
  await assert.rejects(() => withRetry(async () => { calls += 1; throw new Error('x'); }, { retries: 2, baseMs: 1, sleep: async () => {} }));
  assert.equal(calls, 3);
  calls = 0;
  await withRetry(async () => { calls += 1; throw new Error('x'); }, { retries: 5, baseMs: 1, sleep: async () => {}, shouldRetry: () => false }).catch(() => {});
  assert.equal(calls, 1);
});

test('Telegram : seulement les types importants, texte brut tronqué', () => {
  assert.equal(shouldSendTelegram('opportunity'), true);
  assert.equal(shouldSendTelegram('sale_recorded'), false);
  const m = formatTelegramMessage({ title: 'Titre', body: 'x'.repeat(5000) });
  assert.ok(m.length <= 3500);
  assert.equal(formatTelegramMessage({ title: 'T', body: null }), 'T');
  assert.ok(formatTelegramMessage({ title: 'T', body: 'B' }, 'https://exemple.fr/').includes('Ouvrir : https://exemple.fr/'));
  assert.equal(isValidChatId('-1001234567890'), true);
  assert.equal(isValidChatId('abc'), false);
});

test('évolution du prix demandé', () => {
  assert.deepEqual(priceChange(3000, 3000), { changed: false, dropped: false, deltaCents: 0, pct: null });
  assert.deepEqual(priceChange(3000, 2400), { changed: true, dropped: true, deltaCents: -600, pct: -20 });
  assert.equal(priceChange(3000, 3300).dropped, false);
  assert.equal(priceChange(null, 3000).changed, false);
});

test('ligne « opportunité » construite depuis l\'évaluation (non évaluable : aucun score)', () => {
  const ev = evaluateListing({
    listing: { priceCents: 2000, condition: null, description: null, url: null, location: null },
    comparables: [],
    analysis: null,
    settings: { minProfitCents: 1000, minRoiPct: 40, maxPerItemCents: 5000, fee: { percent: 0, fixedCents: 0 } },
  });
  const p = buildOpportunityPayload(ev, null);
  assert.equal(p.recommendation, 'insufficient');
  assert.equal(p.score, null);
  assert.equal(p.score_detail.signature, ev.signature);
});
