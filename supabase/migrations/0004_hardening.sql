-- RESALE BOT : migration 0004 — consolidation V0.3 (sécurité des références, protection des produits,
-- comparables enrichis, recherches enregistrées). Additive : aucune donnée n'est supprimée ni modifiée.

-- 1. Comparables : marque, modèle, taille et pertinence (0 < pertinence <= 1).
alter table public.comparables
  add column if not exists brand text,
  add column if not exists model text,
  add column if not exists size text,
  add column if not exists relevance numeric not null default 1 check (relevance > 0 and relevance <= 1);

-- 2. Un utilisateur ne peut pas référencer les données d'un autre utilisateur.
--    Les clés étrangères ignorent la RLS : sans ce contrôle, un identifiant connu d'une autre personne pourrait être
--    inséré dans une de ses propres lignes. Le déclencheur compare le propriétaire de la ligne référencée.
create or replace function public.enforce_same_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  i int := 0;
  col text;
  parent text;
  ref uuid;
  parent_owner uuid;
begin
  while i < TG_NARGS loop
    col := TG_ARGV[i];
    parent := TG_ARGV[i + 1];
    ref := nullif(to_jsonb(NEW) ->> col, '')::uuid;
    if ref is not null then
      execute format('select user_id from public.%I where id = $1', parent) into parent_owner using ref;
      if parent_owner is null or parent_owner <> NEW.user_id then
        raise exception 'Référence invalide (%) : elle ne correspond pas à une donnée de cet utilisateur', col
          using errcode = '23514';
      end if;
    end if;
    i := i + 2;
  end loop;
  return NEW;
end $$;

do $$
declare
  spec record;
begin
  for spec in
    select * from (values
      ('listings',      array['source_id', 'sources', 'search_config_id', 'search_configs', 'product_id', 'products']),
      ('price_history', array['listing_id', 'listings']),
      ('comparables',   array['product_id', 'products', 'analysis_id', 'analyses']),
      ('analyses',      array['listing_id', 'listings', 'product_id', 'products']),
      ('opportunities', array['listing_id', 'listings', 'analysis_id', 'analyses']),
      ('purchases',     array['opportunity_id', 'opportunities', 'listing_id', 'listings']),
      ('inventory',     array['purchase_id', 'purchases', 'product_id', 'products']),
      ('resales',       array['inventory_id', 'inventory']),
      ('sales',         array['inventory_id', 'inventory', 'resale_id', 'resales']),
      ('expenses',      array['inventory_id', 'inventory']),
      ('notifications', array['listing_id', 'listings'])
    ) as t(tbl, args)
  loop
    execute format('drop trigger if exists trg_same_owner on public.%I', spec.tbl);
    execute format(
      'create trigger trg_same_owner before insert or update on public.%I for each row execute function public.enforce_same_owner(%s)',
      spec.tbl,
      (select string_agg(quote_literal(a), ', ' order by n) from unnest(spec.args) with ordinality as u(a, n))
    );
  end loop;
end $$;

-- 3. Un produit encore utilisé par une annonce ou un article d'inventaire ne peut pas être supprimé directement.
--    (Les suppressions en cascade, par exemple à la suppression d'un compte, restent possibles.)
create or replace function public.protect_used_product()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if pg_trigger_depth() > 1 then
    return OLD;
  end if;
  if exists (select 1 from public.listings where product_id = OLD.id)
     or exists (select 1 from public.inventory where product_id = OLD.id) then
    raise exception 'Produit encore utilisé par une annonce ou un article d''inventaire' using errcode = '23503';
  end if;
  return OLD;
end $$;

drop trigger if exists trg_protect_product on public.products;
create trigger trg_protect_product
  before delete on public.products
  for each row execute function public.protect_used_product();

-- 4. Recherches enregistrées : un nom unique par utilisateur (insensible à la casse).
create unique index if not exists search_configs_user_name_idx on public.search_configs (user_id, lower(name));

-- 5. Notifications : filtrage par type.
create index if not exists notifications_type_idx on public.notifications (user_id, type);
