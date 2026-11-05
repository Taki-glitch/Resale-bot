import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  addExpense, deleteExpense, deleteInventory, fetchInventoryDetail, saveResale, updateInventory,
} from '../services/inventory.ts';
import type { InventoryDetail as Detail } from '../services/inventory.ts';
import { recordSale } from '../services/sales.ts';
import { useSettings } from '../hooks/useSettings.ts';
import PhotoStrip from '../components/PhotoStrip.tsx';
import { INVENTORY_STATUS_LABEL, INVENTORY_STATUS_ORDER, itemCostCents, realizedProfitCents, suggestedPlatformFee } from '../core/inventory.ts';
import type { InventoryStatus } from '../core/inventory.ts';
import { estimateResale } from '../core/estimate.ts';
import { buildResaleDraft, suggestResalePrices } from '../core/resale.ts';
import { NO_FEES } from '../core/profitability.ts';
import { formatEuros, parseEuros } from '../core/format.ts';
import { errMsg } from '../lib/errors.ts';

const field = (c: number | null | undefined): string => (c == null ? '' : String(c / 100).replace('.', ','));
const today = () => new Date().toISOString().slice(0, 10);

export default function InventoryDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      setD(await fetchInventoryDetail(id));
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [id]);
  useEffect(() => {
    void reload();
  }, [reload]);

  if (error) return <p className="text-sm text-loss">{error}</p>;
  if (!d || !id) return <p className="text-sm text-slate-500">Chargement…</p>;

  const cost = itemCostCents(d.view);
  const sold = d.view.status === 'sold';

  async function guard(fn: () => Promise<void>) {
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  async function remove() {
    if (!window.confirm('Supprimer cet article de l\'inventaire ? Son achat enregistré sera supprimé aussi. Cette action est définitive.')) return;
    try {
      await deleteInventory(d!.row.id, d!.view.status, d!.purchase?.id ?? null);
      navigate('/inventaire');
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div className="space-y-6">
      <Link to="/inventaire" className="text-sm text-slate-500 underline">← Inventaire</Link>
      <ItemSection d={d} onSave={(patch) => guard(() => updateInventory(d.row.id, patch))} />

      <section className="space-y-2">
        <h2 className="text-lg font-semibold text-navy-950">Photos</h2>
        <PhotoStrip paths={d.photos} scope={`inventory-${d.row.id}`} onChange={(paths) => guard(() => updateInventory(d.row.id, { photos: paths }))} />
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-navy-950">Coûts</h2>
        <div className="card grid grid-cols-2 gap-3 md:grid-cols-4">
          <div><p className="text-xs text-slate-500">Prix d'achat</p><p className="font-semibold">{d.purchase ? formatEuros(d.purchase.price_cents) : 'inconnu'}</p></div>
          <div><p className="text-xs text-slate-500">Frais d'achat</p><p className="font-semibold">{formatEuros(d.view.purchaseFeesCents)}</p></div>
          <div><p className="text-xs text-slate-500">Dépenses (remise en état…)</p><p className="font-semibold">{formatEuros(d.view.expensesCents)}</p></div>
          <div><p className="text-xs text-slate-500">Coût total</p><p className="font-semibold text-navy-950">{cost === null ? 'inconnu' : formatEuros(cost)}</p></div>
        </div>
        {d.purchase?.condition_notes && <p className="text-sm text-slate-600">État constaté : {d.purchase.condition_notes}</p>}
        {d.purchase?.accessories && <p className="text-sm text-slate-600">Accessoires : {d.purchase.accessories}</p>}
        <ExpenseList d={d} onChange={reload} />
      </section>

      {!sold && <ResaleSection d={d} cost={cost} onSaved={reload} />}
      {!sold ? <SaleSection d={d} cost={cost} onSold={reload} /> : (
        <p className="card text-sm text-slate-700">Cet article est vendu. Retrouve le détail et le bénéfice réalisé dans <Link className="underline" to="/ventes">Ventes</Link>.</p>
      )}

      <button className="btn btn-ghost text-loss" disabled={sold} onClick={remove}>
        {sold ? 'Article vendu : suppression impossible' : "Supprimer l'article"}
      </button>
    </div>
  );
}

function ItemSection({ d, onSave }: { d: Detail; onSave: (p: Parameters<typeof updateInventory>[1]) => Promise<void> }) {
  const [name, setName] = useState(d.view.name);
  const [status, setStatus] = useState<InventoryStatus>(d.view.status);
  const [planned, setPlanned] = useState(field(d.view.plannedPriceCents));
  const [notes, setNotes] = useState((d.row.notes ?? '') as string);
  const [msg, setMsg] = useState<string | null>(null);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (name.trim() === '') return setMsg('Le nom est obligatoire.');
    const startsStock = (status === 'received' || status === 'in_stock') && !d.row.in_stock_since;
    await onSave({
      name: name.trim(),
      status,
      planned_price_cents: parseEuros(planned),
      notes: notes.trim() === '' ? null : notes.trim(),
      ...(startsStock ? { in_stock_since: new Date().toISOString() } : {}),
    });
    setMsg('Enregistré.');
  }

  return (
    <form onSubmit={save} className="card space-y-3">
      <label className="label">Nom de l'article</label>
      <input className="input text-lg font-semibold" value={name} onChange={(e) => setName(e.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Statut</label>
          <select className="input" value={status} onChange={(e) => setStatus(e.target.value as InventoryStatus)}>
            {INVENTORY_STATUS_ORDER.filter((s) => s !== 'sold' || status === 'sold').map((s) => (
              <option key={s} value={s}>{INVENTORY_STATUS_LABEL[s]}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-slate-500">Le statut « Vendu » s'obtient en enregistrant la vente.</p>
        </div>
        <div>
          <label className="label">Prix de vente prévu (€)</label>
          <input className="input" inputMode="decimal" value={planned} onChange={(e) => setPlanned(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input min-h-[72px] py-2" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex items-center gap-3">
        <button className="btn btn-primary" disabled={d.view.status === 'sold'}>Enregistrer</button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
    </form>
  );
}

function ExpenseList({ d, onChange }: { d: Detail; onChange: () => Promise<void> }) {
  const [label, setLabel] = useState('');
  const [category, setCategory] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today());
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const cents = parseEuros(amount);
    if (label.trim() === '' || cents === null || cents <= 0) return setError('Indique un libellé et un montant.');
    try {
      await addExpense({ inventoryId: d.row.id, label, category, amountCents: cents, date });
      setLabel('');
      setAmount('');
      await onChange();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <div className="space-y-2">
      {d.expenses.map((x) => (
        <div key={x.id} className="card flex items-center justify-between gap-2">
          <p className="text-sm">
            {x.label} · <strong>{formatEuros(x.amount_cents)}</strong>
            <span className="text-xs text-slate-500"> · {new Date(x.incurred_at).toLocaleDateString('fr-FR')}</span>
          </p>
          <button
            className="btn btn-ghost !min-h-[36px]"
            onClick={async () => {
              if (window.confirm('Supprimer cette dépense ?')) {
                await deleteExpense(x.id);
                await onChange();
              }
            }}
          >
            Retirer
          </button>
        </div>
      ))}
      <form onSubmit={add} className="card grid grid-cols-2 gap-3">
        <div className="col-span-2"><label className="label">Ajouter une dépense (nettoyage, réparation, emballage…)</label>
          <input className="input" value={label} onChange={(e) => setLabel(e.target.value)} /></div>
        <div><label className="label">Montant (€)</label><input className="input" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <div><label className="label">Date</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
        <div className="col-span-2"><label className="label">Catégorie (facultatif)</label><input className="input" value={category} onChange={(e) => setCategory(e.target.value)} /></div>
        {error && <p className="col-span-2 text-sm text-loss">{error}</p>}
        <div className="col-span-2"><button className="btn btn-ghost">Ajouter la dépense</button></div>
      </form>
    </div>
  );
}

function ResaleSection({ d, cost, onSaved }: { d: Detail; cost: number | null; onSaved: () => Promise<void> }) {
  const { settings } = useSettings();
  const r = d.resale;
  const [title, setTitle] = useState(r?.title ?? '');
  const [description, setDescription] = useState(r?.description ?? '');
  const [keywords, setKeywords] = useState((r?.keywords ?? []).join(', '));
  const [suggested, setSuggested] = useState(field(r?.suggested_price_cents));
  const [min, setMin] = useState(field(r?.min_price_cents));
  const [platform, setPlatform] = useState(r?.platform ?? settings.resalePlatform);
  const [status, setStatus] = useState<'draft' | 'published'>(r?.status === 'published' ? 'published' : 'draft');
  const [msg, setMsg] = useState<string | null>(null);

  const estimate = useMemo(
    () =>
      estimateResale(
        d.comparables.map((c) => ({ priceCents: c.price_cents, kind: c.price_kind, observedAt: c.observed_at, relevance: Number(c.relevance ?? 1), condition: c.condition })),
      ),
    [d.comparables],
  );
  const prices = useMemo(
    () =>
      cost === null
        ? null
        : suggestResalePrices({
            acquisitionCostCents: cost,
            fee: settings.fees[`${platform}:sale`] ?? NO_FEES,
            saleShippingCents: settings.defaultSaleShippingCents,
            minProfitCents: settings.minProfitCents,
            estimateMedianCents: estimate.medianCents,
          }),
    [cost, settings, platform, estimate.medianCents],
  );

  function prefill() {
    const draft = buildResaleDraft({
      name: d.view.name,
      brand: d.product?.brand,
      model: d.product?.model,
      category: d.product?.category,
      condition: d.purchase?.condition_notes,
      accessories: d.purchase?.accessories,
    });
    setTitle(draft.title);
    setDescription(draft.description);
    setKeywords(draft.keywords.join(', '));
    if (prices) {
      setSuggested(field(prices.suggestedCents));
      setMin(field(prices.minAcceptableCents));
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    try {
      await saveResale(d.row.id, r?.id ?? null, {
        title, description, platform, status,
        keywords: keywords.split(',').map((k) => k.trim()).filter(Boolean),
        suggestedPriceCents: parseEuros(suggested),
        minPriceCents: parseEuros(min),
      });
      setMsg('Annonce de revente enregistrée.');
      await onSaved();
    } catch (err) {
      setMsg(errMsg(err));
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-navy-950">Préparer la revente</h2>
      <form onSubmit={save} className="card space-y-3">
        {prices ? (
          <div className="rounded-lg bg-slate-50 p-2 text-sm text-slate-700">
            <p>Prix minimum acceptable : <strong>{prices.minAcceptableCents === null ? '—' : formatEuros(prices.minAcceptableCents)}</strong> · équilibre : {prices.breakEvenCents === null ? '—' : formatEuros(prices.breakEvenCents)}</p>
            <p>Prix conseillé : <strong>{prices.suggestedCents === null ? 'Estimation indisponible' : formatEuros(prices.suggestedCents)}</strong></p>
            <p className="text-xs text-slate-500">{prices.note}</p>
          </div>
        ) : (
          <p className="text-sm text-warn">Coût d'achat inconnu : les prix conseillés ne sont pas calculables.</p>
        )}
        <button type="button" className="btn btn-ghost" onClick={prefill}>Pré-remplir à partir de l'article</button>
        <div><label className="label">Titre</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div><label className="label">Description</label><textarea className="input min-h-[120px] py-2" value={description} onChange={(e) => setDescription(e.target.value)} /></div>
        <div><label className="label">Mots-clés (séparés par des virgules)</label><input className="input" value={keywords} onChange={(e) => setKeywords(e.target.value)} /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Prix proposé (€)</label><input className="input" inputMode="decimal" value={suggested} onChange={(e) => setSuggested(e.target.value)} /></div>
          <div><label className="label">Prix minimum acceptable (€)</label><input className="input" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} /></div>
          <div>
            <label className="label">Plateforme de revente</label>
            <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="vinted">Vinted</option>
              <option value="leboncoin">Leboncoin</option>
            </select>
          </div>
          <div>
            <label className="label">État de l'annonce</label>
            <select className="input" value={status} onChange={(e) => setStatus(e.target.value as 'draft' | 'published')}>
              <option value="draft">Brouillon</option>
              <option value="published">Publiée (manuellement)</option>
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-500">Le texte est construit uniquement à partir des informations saisies. La publication sur la plateforme reste manuelle.</p>
        <div className="flex items-center gap-3">
          <button className="btn btn-primary">Enregistrer l'annonce de revente</button>
          {msg && <span className="text-sm text-slate-600">{msg}</span>}
        </div>
      </form>
    </section>
  );
}

function SaleSection({ d, cost, onSold }: { d: Detail; cost: number | null; onSold: () => Promise<void> }) {
  const { settings } = useSettings();
  const [price, setPrice] = useState(field(d.resale?.suggested_price_cents ?? d.view.plannedPriceCents));
  const [date, setDate] = useState(today());
  const [platform, setPlatform] = useState(d.resale?.platform ?? settings.resalePlatform);
  const [fees, setFees] = useState('');
  const [feesTouched, setFeesTouched] = useState(false);
  const [shipping, setShipping] = useState(field(settings.defaultSaleShippingCents > 0 ? settings.defaultSaleShippingCents : null));
  const [extra, setExtra] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const priceCents = parseEuros(price);
  // Commission proposée selon la plateforme (modifiable) : jamais supposée identique d'une plateforme à l'autre.
  useEffect(() => {
    if (feesTouched || priceCents === null) return;
    setFees(field(suggestedPlatformFee(priceCents, settings.fees[`${platform}:sale`] ?? NO_FEES)));
  }, [priceCents, platform, feesTouched, settings.fees]);

  const profit =
    priceCents === null
      ? null
      : realizedProfitCents({
          priceCents,
          feesCents: parseEuros(fees) ?? 0,
          shippingCents: parseEuros(shipping) ?? 0,
          extraCostsCents: parseEuros(extra) ?? 0,
          acquisitionCostCents: cost,
        });

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (priceCents === null) return setError('Indique le prix réellement encaissé.');
    if (!window.confirm(`Enregistrer la vente à ${price} € ? L'article passera au statut « Vendu ».`)) return;
    setBusy(true);
    try {
      await recordSale({
        inventoryId: d.row.id, itemName: d.view.name, priceCents, soldAt: date, platform,
        feesCents: parseEuros(fees) ?? 0, shippingCents: parseEuros(shipping) ?? 0, extraCostsCents: parseEuros(extra) ?? 0,
      });
      await onSold();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-navy-950">Enregistrer la vente</h2>
      <form onSubmit={submit} className="card space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Prix réellement encaissé (€)</label><input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} /></div>
          <div><label className="label">Date de vente</label><input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div>
            <label className="label">Plateforme de vente</label>
            <select className="input" value={platform} onChange={(e) => setPlatform(e.target.value)}>
              <option value="vinted">Vinted</option>
              <option value="leboncoin">Leboncoin</option>
              <option value="other">Autre</option>
            </select>
          </div>
          <div>
            <label className="label">Commission / frais de plateforme (€)</label>
            <input className="input" inputMode="decimal" value={fees} onChange={(e) => { setFees(e.target.value); setFeesTouched(true); }} />
          </div>
          <div><label className="label">Livraison à ta charge (€)</label><input className="input" inputMode="decimal" value={shipping} onChange={(e) => setShipping(e.target.value)} /></div>
          <div><label className="label">Autres dépenses de vente (€)</label><input className="input" inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} /></div>
        </div>
        <div className="rounded-lg bg-slate-50 p-2 text-sm">
          {profit === null ? (
            <span className="text-warn">Bénéfice réalisé inconnu : {priceCents === null ? 'saisis le prix' : "le coût d'achat n'est pas enregistré"}.</span>
          ) : (
            <span>
              Bénéfice net réalisé : <strong className={profit >= 0 ? 'text-gain' : 'text-loss'}>{formatEuros(profit)}</strong>
              {d.view.plannedPriceCents !== null && priceCents !== null && (
                <span className="text-slate-500"> · prévu {formatEuros(d.view.plannedPriceCents)}, écart {formatEuros(priceCents - d.view.plannedPriceCents)}</span>
              )}
            </span>
          )}
        </div>
        {error && <p className="text-sm text-loss">{error}</p>}
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : 'Enregistrer la vente'}</button>
      </form>
    </section>
  );
}
