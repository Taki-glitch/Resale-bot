import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteListing, fetchListingDetail } from '../services/listings.ts';
import { addComparable, deleteComparable } from '../services/comparables.ts';
import { runAnalysis } from '../services/analysis.ts';
import { fileToJpegBase64 } from '../lib/images.ts';
import { estimateResale, INSUFFICIENT_LABEL } from '../core/estimate.ts';
import { parseEuros } from '../core/format.ts';
import { formatEuros } from '../core/settings.ts';
import { errMsg } from '../lib/errors.ts';
import AnalysisView from '../components/AnalysisView.tsx';
import ProfitCalculator from '../components/ProfitCalculator.tsx';
import type { ListingDetail as Detail, PriceKind } from '../types.ts';

export default function ListingDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [detail, setDetail] = useState<Detail | null>(null);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!id) return;
    try {
      setDetail(await fetchListingDetail(id));
      setError(null);
    } catch (e) {
      setError(errMsg(e));
    }
  }, [id]);
  useEffect(() => {
    void reload();
  }, [reload]);

  const estimate = useMemo(
    () => estimateResale((detail?.comparables ?? []).map((c) => ({ priceCents: c.price_cents, kind: c.price_kind }))),
    [detail],
  );

  if (error) return <p className="text-sm text-loss">{error}</p>;
  if (!detail) return <p className="text-sm text-slate-500">Chargement…</p>;
  const { listing, product, comparables, analysis } = detail;

  async function remove() {
    if (!window.confirm('Supprimer cette annonce et ses comparables ?')) return;
    try {
      await deleteListing(listing.id, listing.product_id);
      navigate('/recherche');
    } catch (e) {
      setError(errMsg(e));
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <Link to="/recherche" className="text-sm text-slate-500 underline">← Annonces</Link>
        <h1 className="mt-1 text-2xl font-semibold text-navy-950">{listing.title}</h1>
        <p className="text-sm text-slate-600">
          {listing.platform} · {listing.price_cents == null ? 'prix inconnu' : formatEuros(listing.price_cents)}
          {listing.condition ? ` · ${listing.condition}` : ''}
          {listing.location ? ` · ${listing.location}` : ''}
        </p>
        {listing.url && (
          <a className="text-sm underline" href={listing.url} target="_blank" rel="noopener noreferrer">
            Ouvrir l'annonce d'origine
          </a>
        )}
        {product && (product.brand || product.model || product.category) && (
          <p className="mt-1 text-sm text-slate-500">
            Produit : {[product.brand, product.model, product.category].filter(Boolean).join(' · ')}
          </p>
        )}
      </div>

      <AnalysisSection listingId={listing.id} analysis={analysis} onDone={reload} />

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-navy-950">Comparables et estimation</h2>
        <div className={`card ${estimate.status === 'ok' ? '' : 'border-warn'}`}>
          {estimate.status === 'ok' && estimate.medianCents !== null ? (
            <>
              <p className="text-sm text-slate-500">
                Prix de revente estimé ({estimate.basis === 'sold' ? 'ventes réalisées' : 'prix affichés'})
              </p>
              <p className="text-2xl font-semibold text-navy-950">{formatEuros(estimate.medianCents)}</p>
              <p className="text-sm text-slate-600">
                Fourchette {formatEuros(estimate.lowCents ?? 0)} à {formatEuros(estimate.highCents ?? 0)} · {estimate.count} comparable(s)
              </p>
            </>
          ) : (
            <p className="font-medium text-warn">{INSUFFICIENT_LABEL}</p>
          )}
          {estimate.warnings.map((w) => (
            <p key={w} className="mt-1 text-xs text-warn">{w}</p>
          ))}
        </div>

        {product ? (
          <>
            <ComparableList comparables={comparables} onChange={reload} />
            <ComparableForm productId={product.id} onAdded={reload} />
          </>
        ) : (
          <p className="text-sm text-slate-500">Cette annonce n'a plus de fiche produit : impossible d'ajouter des comparables.</p>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-navy-950">Rentabilité</h2>
        <ProfitCalculator
          initialSaleCents={estimate.status === 'ok' ? estimate.medianCents : null}
          initialPurchaseCents={listing.price_cents}
          initialPlatform="vinted"
        />
      </section>

      <button className="btn btn-ghost text-loss" onClick={remove}>Supprimer l'annonce</button>
    </div>
  );
}

function AnalysisSection({
  listingId,
  analysis,
  onDone,
}: {
  listingId: string;
  analysis: Detail['analysis'];
  onDone: () => Promise<void>;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    try {
      const images = await Promise.all(files.slice(0, 3).map((f) => fileToJpegBase64(f)));
      await runAnalysis(listingId, images);
      setFiles([]);
      await onDone();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold text-navy-950">Analyse IA</h2>
      <div className="card space-y-3">
        <p className="text-xs text-slate-500">
          L'IA identifie le produit et distingue le certain, le déduit et l'inconnu. Elle ne donne aucun prix et ne peut pas
          authentifier un produit. Les photos (3 maximum) sont envoyées pour l'analyse puis non conservées.
        </p>
        <input
          type="file"
          accept="image/*"
          multiple
          onChange={(e) => setFiles(Array.from(e.target.files ?? []).slice(0, 3))}
          className="text-sm"
        />
        <div>
          <button className="btn btn-primary" onClick={run} disabled={busy}>
            {busy ? 'Analyse en cours…' : analysis ? "Relancer l'analyse" : "Lancer l'analyse"}
          </button>
        </div>
        {error && <p className="text-sm text-loss">{error}</p>}
      </div>
      {analysis && (
        <div className="card">
          <AnalysisView analysis={analysis} />
        </div>
      )}
    </section>
  );
}

function ComparableList({
  comparables,
  onChange,
}: {
  comparables: Detail['comparables'];
  onChange: () => Promise<void>;
}) {
  if (comparables.length === 0) return <p className="text-sm text-slate-500">Aucun comparable pour l'instant (3 minimum).</p>;
  return (
    <div className="space-y-2">
      {comparables.map((c) => (
        <div key={c.id} className="card flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium text-navy-950">
              {formatEuros(c.price_cents)}{' '}
              <span className={`text-xs ${c.price_kind === 'sold' ? 'text-gain' : 'text-warn'}`}>
                {c.price_kind === 'sold' ? 'vendu' : 'affiché'}
              </span>
            </p>
            <p className="truncate text-sm text-slate-500">
              {c.source} · {new Date(c.observed_at).toLocaleDateString('fr-FR')}
              {c.condition ? ` · ${c.condition}` : ''}
            </p>
          </div>
          <button
            className="btn btn-ghost"
            onClick={async () => {
              await deleteComparable(c.id);
              await onChange();
            }}
          >
            Retirer
          </button>
        </div>
      ))}
    </div>
  );
}

function ComparableForm({ productId, onAdded }: { productId: string; onAdded: () => Promise<void> }) {
  const [source, setSource] = useState('');
  const [kind, setKind] = useState<PriceKind>('sold');
  const [price, setPrice] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [condition, setCondition] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const priceCents = parseEuros(price);
    if (source.trim() === '') return setError('Indique la source (ex. Vinted, Leboncoin, eBay).');
    if (priceCents === null || priceCents <= 0) return setError('Indique un prix valide.');
    try {
      await addComparable({ productId, source, url, priceCents, kind, condition, observedAt: date });
      setPrice('');
      setCondition('');
      setUrl('');
      await onAdded();
    } catch (err) {
      setError(errMsg(err));
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <p className="font-medium text-navy-950">Ajouter un comparable</p>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Type de prix</label>
          <select className="input" value={kind} onChange={(e) => setKind(e.target.value as PriceKind)}>
            <option value="sold">Vente réalisée</option>
            <option value="asking">Prix affiché</option>
          </select>
        </div>
        <div>
          <label className="label">Prix (€)</label>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="label">Source</label>
          <input className="input" value={source} onChange={(e) => setSource(e.target.value)} placeholder="Vinted, eBay…" />
        </div>
        <div>
          <label className="label">Date</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">État</label>
          <input className="input" value={condition} onChange={(e) => setCondition(e.target.value)} />
        </div>
        <div>
          <label className="label">Lien (optionnel)</label>
          <input className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-loss">{error}</p>}
      <button className="btn btn-primary">Ajouter</button>
    </form>
  );
}
