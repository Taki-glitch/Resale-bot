import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { DuplicateListingError } from '../services/listings.ts';
import type { NewListingInput } from '../services/listings.ts';
import { parseListingUrl } from '../core/listing.ts';
import { parseEuros } from '../core/format.ts';
import { PLATFORM_LABEL } from '../lib/labels.ts';
import { errMsg } from '../lib/errors.ts';
import type { Platform } from '../types.ts';

export const CONDITIONS = ['Neuf avec étiquette', 'Neuf sans étiquette', 'Très bon état', 'Bon état', 'Satisfaisant', 'Inconnu'];

export interface ListingFormValues {
  platform: Platform;
  url: string;
  title: string;
  price: string;
  condition: string;
  description: string;
  location: string;
  brand: string;
  model: string;
  category: string;
}

export const EMPTY_LISTING_FORM: ListingFormValues = {
  platform: 'vinted',
  url: '',
  title: '',
  price: '',
  condition: 'Inconnu',
  description: '',
  location: '',
  brand: '',
  model: '',
  category: '',
};

/** Formulaire partagé : ajout et modification d'une annonce (saisie manuelle). */
export default function ListingForm({
  initial,
  heading,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: ListingFormValues;
  heading: string;
  submitLabel: string;
  onSubmit: (input: NewListingInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [f, setF] = useState<ListingFormValues>(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupId, setDupId] = useState<string | null>(null);

  const set = (patch: Partial<ListingFormValues>) => setF((prev) => ({ ...prev, ...patch }));

  function onUrl(url: string) {
    const parsed = url ? parseListingUrl(url) : null;
    set({ url, ...(parsed && parsed.platform !== 'other' ? { platform: parsed.platform } : {}) });
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setDupId(null);
    if (f.title.trim() === '') return setError('Le titre est obligatoire.');
    const priceCents = parseEuros(f.price);
    if (priceCents === null) return setError('Indique le prix demandé (ex. 25 ou 25,50).');
    setBusy(true);
    try {
      await onSubmit({
        platform: f.platform,
        url: f.url,
        title: f.title,
        description: f.description,
        priceCents,
        condition: f.condition === 'Inconnu' ? '' : f.condition,
        location: f.location,
        brand: f.brand,
        model: f.model,
        category: f.category,
      });
    } catch (err) {
      if (err instanceof DuplicateListingError) setDupId(err.existingId);
      else setError(errMsg(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <h2 className="font-semibold text-navy-950">{heading}</h2>
      <p className="text-xs text-slate-500">
        Saisie manuelle : le lien est conservé comme référence, il n'est jamais visité automatiquement.
      </p>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="md:col-span-2">
          <label className="label">Lien de l'annonce (optionnel)</label>
          <input className="input" type="url" value={f.url} onChange={(e) => onUrl(e.target.value)} placeholder="https://…" />
        </div>
        <div>
          <label className="label">Plateforme</label>
          <select className="input" value={f.platform} onChange={(e) => set({ platform: e.target.value as Platform })}>
            {(Object.keys(PLATFORM_LABEL) as Platform[]).map((p) => (
              <option key={p} value={p}>{PLATFORM_LABEL[p]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Prix demandé (€)</label>
          <input className="input" inputMode="decimal" value={f.price} onChange={(e) => set({ price: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Titre</label>
          <input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} />
        </div>
        <div>
          <label className="label">État déclaré</label>
          <select className="input" value={f.condition} onChange={(e) => set({ condition: e.target.value })}>
            {CONDITIONS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Localisation</label>
          <input className="input" value={f.location} onChange={(e) => set({ location: e.target.value })} />
        </div>
        <div>
          <label className="label">Marque (optionnel)</label>
          <input className="input" value={f.brand} onChange={(e) => set({ brand: e.target.value })} />
        </div>
        <div>
          <label className="label">Modèle (optionnel)</label>
          <input className="input" value={f.model} onChange={(e) => set({ model: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Catégorie (optionnel)</label>
          <input className="input" value={f.category} onChange={(e) => set({ category: e.target.value })} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Description</label>
          <textarea className="input min-h-[96px] py-2" value={f.description} onChange={(e) => set({ description: e.target.value })} />
        </div>
      </div>
      {error && <p className="text-sm text-loss">{error}</p>}
      {dupId && (
        <p className="text-sm text-warn">
          Cette annonce existe déjà. <Link className="underline" to={`/annonce/${dupId}`}>Ouvrir la fiche existante</Link>
        </p>
      )}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : submitLabel}</button>
        {onCancel && (
          <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
        )}
      </div>
    </form>
  );
}
