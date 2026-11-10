-- RESALE BOT : migration 0006 (V0.5) — tâche planifiée (verrou, journal d'exécution), historique de prix.
-- Additive : aucune donnée existante n'est supprimée ni modifiée.

-- 1. Verrou des traitements concurrents. Table privée : RLS activée SANS politique, donc inaccessible aux utilisateurs
--    (seule la clé « service » de la tâche planifiée y accède, via les fonctions ci-dessous).
create table if not exists public.job_locks (
  job text primary key,
  owner text not null,
  locked_until timestamptz not null
);
alter table public.job_locks enable row level security;

create or replace function public.acquire_job_lock(p_job text, p_owner text, p_minutes integer)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ok boolean;
begin
  insert into public.job_locks (job, owner, locked_until)
  values (p_job, p_owner, now() + make_interval(mins => p_minutes))
  on conflict (job) do update
    set owner = excluded.owner, locked_until = excluded.locked_until
    where public.job_locks.locked_until < now()
  returning true into v_ok;
  return coalesce(v_ok, false);
end $$;

create or replace function public.release_job_lock(p_job text, p_owner text)
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.job_locks where job = p_job and owner = p_owner;
$$;

revoke execute on function public.acquire_job_lock(text, text, integer) from public, anon, authenticated;
revoke execute on function public.release_job_lock(text, text) from public, anon, authenticated;
grant execute on function public.acquire_job_lock(text, text, integer) to service_role;
grant execute on function public.release_job_lock(text, text) to service_role;

-- 2. Journal d'exécution des tâches planifiées : chaque utilisateur lit SES exécutions, seule la clé service écrit.
create table if not exists public.job_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  job text not null,
  status text not null check (status in ('running', 'success', 'partial', 'error', 'skipped')),
  stats jsonb not null default '{}'::jsonb,
  error text,
  started_at timestamptz not null default now(),
  finished_at timestamptz
);
create index if not exists job_runs_user_idx on public.job_runs (user_id, started_at desc);
alter table public.job_runs enable row level security;
drop policy if exists job_runs_select_own on public.job_runs;
create policy job_runs_select_own on public.job_runs for select to authenticated using (user_id = auth.uid());

-- 3. Historique des prix d'annonce.
create index if not exists price_history_user_idx on public.price_history (user_id, observed_at desc);
