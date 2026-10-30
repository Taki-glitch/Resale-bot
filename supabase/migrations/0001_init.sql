-- RESALE BOT : migration 0001 (V0.1)
-- Conventions : UUID, dates en timestamptz (UTC), montants en centimes (integer),
-- chaque table métier porte user_id (prêt multi-utilisateurs) protégé par RLS.

-- ---------- Fonctions utilitaires ----------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ---------- users (profil + réglages) ----------
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  display_name text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_users_updated before update on public.users
  for each row execute function public.set_updated_at();

-- Création automatique du profil à l'inscription.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email) values (new.id, new.email) on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- sources / recherches ----------
create table public.sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  platform text not null check (platform in ('vinted','leboncoin','manual','other')),
  name text not null,
  connector text not null default 'manual',
  is_authorized boolean not null default false, -- true seulement si un accès officiel/autorisé existe
  is_enabled boolean not null default true,
  config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.search_configs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  name text not null,
  platform text,
  filters jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_search_configs_updated before update on public.search_configs
  for each row execute function public.set_updated_at();

-- ---------- produits ----------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  name text not null,
  brand text,
  model text,
  reference text,
  category text,
  created_at timestamptz not null default now()
);
create index products_user_brand_model_idx on public.products (user_id, brand, model);

-- ---------- annonces ----------
create table public.listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  source_id uuid references public.sources(id) on delete set null,
  search_config_id uuid references public.search_configs(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  platform text not null check (platform in ('vinted','leboncoin','manual','other')),
  external_id text,
  url text,
  title text not null,
  description text,
  price_cents integer check (price_cents >= 0),
  currency text not null default 'EUR',
  condition text,
  location text,
  distance_km numeric,
  seller_ref text,              -- référence minimale du vendeur, pas de données personnelles
  photos jsonb not null default '[]'::jsonb,
  content_hash text,            -- empreinte pour la détection de doublons
  status text not null default 'active' check (status in ('active','unavailable','expired')),
  is_demo boolean not null default false,
  published_at timestamptz,
  detected_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index listings_unique_external on public.listings (user_id, platform, external_id)
  where external_id is not null;
create index listings_hash_idx on public.listings (user_id, content_hash) where content_hash is not null;
create index listings_detected_idx on public.listings (user_id, detected_at desc);
create trigger trg_listings_updated before update on public.listings
  for each row execute function public.set_updated_at();

create table public.price_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  price_cents integer not null check (price_cents >= 0),
  observed_at timestamptz not null default now()
);
create index price_history_listing_idx on public.price_history (listing_id, observed_at desc);

-- ---------- comparables (prix affichés ≠ prix réellement vendus) ----------
create table public.comparables (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  product_id uuid references public.products(id) on delete cascade,
  analysis_id uuid,
  source text not null,
  url text,
  price_cents integer not null check (price_cents >= 0),
  price_kind text not null check (price_kind in ('asking','sold')),
  condition text,
  observed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index comparables_product_idx on public.comparables (user_id, product_id, observed_at desc);

-- ---------- analyses IA ----------
create table public.analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  known jsonb not null default '{}'::jsonb,     -- informations certaines
  inferred jsonb not null default '{}'::jsonb,  -- informations déduites
  unknown jsonb not null default '[]'::jsonb,   -- informations inconnues
  estimated_resale_cents integer check (estimated_resale_cents >= 0),
  confidence numeric check (confidence between 0 and 1),
  sufficient_data boolean not null default false, -- false => "Estimation insuffisamment documentée"
  model text,
  created_at timestamptz not null default now()
);
create index analyses_listing_idx on public.analyses (listing_id, created_at desc);
alter table public.comparables
  add constraint comparables_analysis_fk foreign key (analysis_id) references public.analyses(id) on delete set null;

-- ---------- opportunités ----------
create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  listing_id uuid not null references public.listings(id) on delete cascade,
  analysis_id uuid references public.analyses(id) on delete set null,
  score integer check (score between 0 and 100),
  score_detail jsonb not null default '{}'::jsonb,
  risk_level text check (risk_level in ('low','medium','high')),
  status text not null default 'new'
    check (status in ('new','to_check','interesting','to_negotiate','rejected','bought','expired')),
  est_profit_cents integer,   -- ESTIMATION, jamais un bénéfice garanti
  max_buy_cents integer,
  detected_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, listing_id)
);
create index opportunities_rank_idx on public.opportunities (user_id, status, score desc);
create trigger trg_opportunities_updated before update on public.opportunities
  for each row execute function public.set_updated_at();

-- ---------- achats / inventaire / reventes / ventes (données RÉELLES) ----------
create table public.purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  opportunity_id uuid references public.opportunities(id) on delete set null,
  listing_id uuid references public.listings(id) on delete set null,
  purchased_at timestamptz not null default now(),
  price_cents integer not null check (price_cents >= 0),
  fees_cents integer not null default 0 check (fees_cents >= 0),
  platform text,
  seller_ref text,
  url text,
  condition_notes text,
  accessories text,
  comments text,
  receipt_path text,           -- chemin Supabase Storage
  created_at timestamptz not null default now()
);

create table public.inventory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  purchase_id uuid references public.purchases(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  status text not null default 'bought' check (status in
    ('to_buy','bought','shipping','received','in_stock','preparing','listed','sold','returned','cancelled')),
  photos jsonb not null default '[]'::jsonb,
  notes text,
  in_stock_since timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index inventory_status_idx on public.inventory (user_id, status);
create trigger trg_inventory_updated before update on public.inventory
  for each row execute function public.set_updated_at();

create table public.resales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  inventory_id uuid not null references public.inventory(id) on delete cascade,
  title text,
  description text,
  characteristics jsonb not null default '[]'::jsonb,
  keywords text[] not null default '{}',
  suggested_price_cents integer check (suggested_price_cents >= 0),
  min_price_cents integer check (min_price_cents >= 0),
  platform text,
  status text not null default 'draft' check (status in ('draft','published','closed')),
  created_at timestamptz not null default now()
);

create table public.sales (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  inventory_id uuid references public.inventory(id) on delete set null,
  resale_id uuid references public.resales(id) on delete set null,
  sold_at timestamptz not null default now(),
  price_cents integer not null check (price_cents >= 0),
  platform text,
  fees_cents integer not null default 0 check (fees_cents >= 0),
  extra_costs_cents integer not null default 0 check (extra_costs_cents >= 0),
  created_at timestamptz not null default now()
);
create index sales_sold_at_idx on public.sales (user_id, sold_at desc);

-- Bénéfice RÉEL = vente - frais - coûts - (prix d'achat + frais d'achat). Null si l'achat est inconnu.
create view public.sales_with_profit with (security_invoker = true) as
select s.*,
  case when p.id is null then null
       else s.price_cents - s.fees_cents - s.extra_costs_cents - (p.price_cents + p.fees_cents)
  end as realized_profit_cents
from public.sales s
left join public.inventory i on i.id = s.inventory_id
left join public.purchases p on p.id = i.purchase_id;

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  inventory_id uuid references public.inventory(id) on delete set null,
  label text not null,
  category text,
  amount_cents integer not null check (amount_cents >= 0),
  incurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ---------- notifications / audit ----------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  channel text not null default 'in_app' check (channel in ('in_app','telegram')),
  dedup_key text,              -- évite les notifications répétitives
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index notifications_dedup_idx on public.notifications (user_id, channel, dedup_key)
  where dedup_key is not null;
create index notifications_unread_idx on public.notifications (user_id, created_at desc) where read_at is null;

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references public.users(id) on delete cascade,
  action text not null,
  entity text,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_user_idx on public.audit_logs (user_id, created_at desc);

-- ---------- RLS ----------
alter table public.users enable row level security;
create policy users_select_own on public.users for select to authenticated using (id = auth.uid());
create policy users_update_own on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

do $$
declare t text;
begin
  foreach t in array array[
    'sources','search_configs','products','listings','price_history','comparables','analyses',
    'opportunities','purchases','inventory','resales','sales','expenses','notifications'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format(
      'create policy owner_all on public.%I for all to authenticated
         using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- Journal d'audit : lecture et ajout seulement (pas de modification ni de suppression).
alter table public.audit_logs enable row level security;
create policy audit_select_own on public.audit_logs for select to authenticated using (user_id = auth.uid());
create policy audit_insert_own on public.audit_logs for insert to authenticated with check (user_id = auth.uid());
