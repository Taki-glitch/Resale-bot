
-- RESALE BOT V0.3
-- Les tables search_configs, opportunities et notifications existent déjà en V0.1.
-- Cette migration ajoute des index adaptés aux filtres V0.3 et ne supprime aucune donnée.

create index if not exists search_configs_user_active_idx
  on public.search_configs (user_id, is_active, updated_at desc);

create index if not exists listings_user_platform_detected_idx
  on public.listings (user_id, platform, detected_at desc);

create index if not exists listings_user_status_price_idx
  on public.listings (user_id, status, price_cents);

create index if not exists opportunities_user_risk_score_idx
  on public.opportunities (user_id, risk_level, score desc);

create index if not exists notifications_user_read_created_idx
  on public.notifications (user_id, read_at, created_at desc);

-- Les politiques owner_all de la migration initiale couvrent déjà ces tables.
-- Aucun secret, aucune tâche planifiée et aucun accès externe ne sont créés ici.
