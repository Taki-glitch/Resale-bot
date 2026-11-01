-- RESALE BOT : migration 0003 (V0.3) — additive, sans effet sur les données existantes.

-- Provenance des informations d'une annonce : saisie manuelle, import, source autorisée.
alter table public.listings
  add column if not exists source_kind text not null default 'manual'
    check (source_kind in ('manual', 'import', 'authorized_source'));

-- Évaluation : recommandation, confiance, marge nette, sélection personnelle.
alter table public.opportunities
  add column if not exists recommendation text
    check (recommendation in ('excellent', 'good', 'conditional', 'poor', 'avoid', 'insufficient')),
  add column if not exists confidence numeric check (confidence between 0 and 1),
  add column if not exists net_margin_pct numeric,
  add column if not exists is_selected boolean not null default false;

-- Lien d'une notification vers son annonce (suppression en cascade).
alter table public.notifications
  add column if not exists listing_id uuid references public.listings (id) on delete cascade;

create index if not exists opportunities_selected_idx on public.opportunities (user_id) where is_selected;
create index if not exists notifications_listing_idx on public.notifications (listing_id);
