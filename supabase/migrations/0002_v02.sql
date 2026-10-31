-- RESALE BOT : migration 0002 (V0.2) — additive, sans effet sur la V0.1.

-- Détails de l'analyse IA : état, défauts, accessoires, note d'authenticité, signaux de risque.
alter table public.analyses
  add column if not exists details jsonb not null default '{}'::jsonb;

-- Limitation du nombre d'analyses par utilisateur (voir la fonction analyze-listing).
create index if not exists analyses_user_created_idx on public.analyses (user_id, created_at desc);
