-- RESALE BOT : migration 0005 (V0.4) — achats, inventaire, reventes, ventes, photos.
-- Additive : aucune donnée existante n'est supprimée. Les tables concernées existent depuis 0001.

-- 1. Statut « réservé » dans l'inventaire.
alter table public.inventory drop constraint if exists inventory_status_check;
alter table public.inventory add constraint inventory_status_check check (status in
  ('to_buy','bought','shipping','received','in_stock','preparing','listed','reserved','sold','returned','cancelled'));

-- 2. Prix de vente prévu (inventaire) et frais de livraison à la vente.
alter table public.inventory add column if not exists planned_price_cents integer check (planned_price_cents >= 0);
alter table public.sales add column if not exists shipping_cents integer not null default 0 check (shipping_cents >= 0);

-- Une seule fiche de revente par article.
create unique index if not exists resales_inventory_uidx on public.resales (inventory_id);

-- 3. Bénéfice RÉEL = vente - commission - livraison - autres coûts - coût d'acquisition
--    (prix d'achat + frais d'achat + dépenses de remise en état de l'article). Null si l'achat est inconnu : rien n'est inventé.
drop view if exists public.sales_with_profit;
create view public.sales_with_profit with (security_invoker = true) as
select s.*,
  case when p.id is null then null
       else p.price_cents + p.fees_cents + coalesce(e.total, 0)
  end as acquisition_cost_cents,
  case when p.id is null then null
       else s.price_cents - s.fees_cents - s.shipping_cents - s.extra_costs_cents
            - (p.price_cents + p.fees_cents + coalesce(e.total, 0))
  end as realized_profit_cents
from public.sales s
left join public.inventory i on i.id = s.inventory_id
left join public.purchases p on p.id = i.purchase_id
left join (select inventory_id, sum(amount_cents) as total from public.expenses group by inventory_id) e
  on e.inventory_id = s.inventory_id;

-- 4. Enregistrement atomique d'un achat : achat + article d'inventaire + statut de l'opportunité, en une seule transaction.
--    SECURITY INVOKER (défaut) : la RLS de l'utilisateur s'applique ; les déclencheurs de propriétaire aussi.
create or replace function public.record_purchase(
  p_listing_id uuid,
  p_price_cents integer,
  p_fees_cents integer,
  p_purchased_at timestamptz,
  p_platform text,
  p_seller_ref text,
  p_notes text,
  p_accessories text
) returns uuid
language plpgsql
as $$
declare
  v_listing public.listings%rowtype;
  v_opp uuid;
  v_purchase uuid;
  v_inventory uuid;
begin
  select * into v_listing from public.listings where id = p_listing_id;
  if not found then
    raise exception 'Annonce introuvable';
  end if;
  select id into v_opp from public.opportunities where listing_id = p_listing_id;

  insert into public.purchases
    (opportunity_id, listing_id, purchased_at, price_cents, fees_cents, platform, seller_ref, url, condition_notes, accessories)
  values
    (v_opp, p_listing_id, coalesce(p_purchased_at, now()), p_price_cents, coalesce(p_fees_cents, 0),
     nullif(p_platform, ''), nullif(p_seller_ref, ''), v_listing.url, nullif(p_notes, ''), nullif(p_accessories, ''))
  returning id into v_purchase;

  insert into public.inventory (purchase_id, product_id, name, status, photos)
  values (v_purchase, v_listing.product_id, v_listing.title, 'bought', v_listing.photos)
  returning id into v_inventory;

  if v_opp is not null then
    update public.opportunities set status = 'bought' where id = v_opp;
  end if;
  return v_inventory;
end $$;

-- 5. Enregistrement atomique d'une vente : vente + statut « vendu » + fiche de revente clôturée.
create or replace function public.record_sale(
  p_inventory_id uuid,
  p_price_cents integer,
  p_sold_at timestamptz,
  p_platform text,
  p_fees_cents integer,
  p_shipping_cents integer,
  p_extra_costs_cents integer
) returns uuid
language plpgsql
as $$
declare
  v_inv public.inventory%rowtype;
  v_resale uuid;
  v_sale uuid;
begin
  select * into v_inv from public.inventory where id = p_inventory_id for update;
  if not found then
    raise exception 'Article introuvable';
  end if;
  if v_inv.status = 'sold' then
    raise exception 'Cet article est déjà marqué comme vendu';
  end if;
  select id into v_resale from public.resales where inventory_id = p_inventory_id;

  insert into public.sales
    (inventory_id, resale_id, sold_at, price_cents, platform, fees_cents, shipping_cents, extra_costs_cents)
  values
    (p_inventory_id, v_resale, coalesce(p_sold_at, now()), p_price_cents, nullif(p_platform, ''),
     coalesce(p_fees_cents, 0), coalesce(p_shipping_cents, 0), coalesce(p_extra_costs_cents, 0))
  returning id into v_sale;

  update public.inventory set status = 'sold' where id = p_inventory_id;
  if v_resale is not null then
    update public.resales set status = 'closed' where id = v_resale;
  end if;
  return v_sale;
end $$;

revoke execute on function public.record_purchase(uuid, integer, integer, timestamptz, text, text, text, text) from public, anon;
revoke execute on function public.record_sale(uuid, integer, timestamptz, text, integer, integer, integer) from public, anon;
grant execute on function public.record_purchase(uuid, integer, integer, timestamptz, text, text, text, text) to authenticated;
grant execute on function public.record_sale(uuid, integer, timestamptz, text, integer, integer, integer) to authenticated;

-- 6. Photos : compartiment privé « photos », un dossier par utilisateur (<id utilisateur>/...).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('photos', 'photos', false, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false, file_size_limit = 2097152, allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists photos_select_own on storage.objects;
drop policy if exists photos_insert_own on storage.objects;
drop policy if exists photos_update_own on storage.objects;
drop policy if exists photos_delete_own on storage.objects;

create policy photos_select_own on storage.objects for select to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_insert_own on storage.objects for insert to authenticated
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_update_own on storage.objects for update to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
create policy photos_delete_own on storage.objects for delete to authenticated
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
