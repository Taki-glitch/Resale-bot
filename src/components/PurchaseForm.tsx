import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { recordPurchase } from '../services/inventory.ts';
import { useSettings } from '../hooks/useSettings.ts';
import { parseEuros } from '../core/format.ts';
import { errMsg } from '../lib/errors.ts';
import type { Listing } from '../types.ts';

const field = (cents?: number | null): string => (cents == null ? '' : String(cents / 100).replace('.', ','));

/** « J'ai acheté cet article » : crée l'achat et l'article d'inventaire (jamais d'achat automatique : c'est vous qui confirmez). */
export default function PurchaseForm({ listing, alreadyBought, onCancel }: { listing: Listing; alreadyBought: boolean; onCancel: () => void }) {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [price, setPrice] = useState(field(listing.price_cents));
  const [fees, setFees] = useState(field(settings.defaultPurchaseShippingCents > 0 ? settings.defaultPurchaseShippingCents : null));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [platform, setPlatform] = useState(listing.platform === 'manual' ? '' : listing.platform);
  const [seller, setSeller] = useState('');
  const [notes, setNotes] = useState('');
  const [accessories, setAccessories] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const priceCents = parseEuros(price);
    if (priceCents === null) return setError('Indique le prix réellement payé.');
    if (!window.confirm(`Confirmer l'achat à ${price} € ? Il sera ajouté à votre inventaire.`)) return;
    setBusy(true);
    try {
      const inventoryId = await recordPurchase({
        listingId: listing.id,
        priceCents,
        feesCents: parseEuros(fees) ?? 0,
        purchasedAt: date,
        platform,
        sellerRef: seller,
        notes,
        accessories,
      });
      navigate(`/inventaire/${inventoryId}`);
    } catch (err) {
      setError(errMsg(err));
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="card space-y-3">
      <h2 className="font-semibold text-navy-950">Ajouter à l'inventaire (achat effectué)</h2>
      <p className="text-xs text-slate-500">
        Resale Bot n'achète jamais à votre place : enregistrez ici un achat que vous avez déjà réalisé, au prix réellement payé.
      </p>
      {alreadyBought && (
        <p className="rounded-lg bg-orange-50 p-2 text-sm text-warn">
          Cette annonce est déjà marquée « Achetée ». N'enregistre un nouvel achat que s'il s'agit d'un autre exemplaire.
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label">Prix payé (€)</label>
          <input className="input" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
        </div>
        <div>
          <label className="label">Frais associés (livraison, commission) (€)</label>
          <input className="input" inputMode="decimal" value={fees} onChange={(e) => setFees(e.target.value)} />
        </div>
        <div>
          <label className="label">Date d'achat</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label className="label">Plateforme d'achat</label>
          <input className="input" value={platform} onChange={(e) => setPlatform(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Vendeur (pseudo, facultatif — limite les données personnelles)</label>
          <input className="input" value={seller} onChange={(e) => setSeller(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">État constaté à la réception</label>
          <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        <div className="col-span-2">
          <label className="label">Accessoires</label>
          <input className="input" value={accessories} onChange={(e) => setAccessories(e.target.value)} />
        </div>
      </div>
      {error && <p className="text-sm text-loss">{error}</p>}
      <div className="flex gap-2">
        <button className="btn btn-primary" disabled={busy}>{busy ? 'Enregistrement…' : "Confirmer l'achat"}</button>
        <button type="button" className="btn btn-ghost" onClick={onCancel}>Annuler</button>
      </div>
    </form>
  );
}
