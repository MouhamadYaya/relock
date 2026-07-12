-- Blocus — schéma Supabase V1
-- iOS uniquement. RLS activé partout : chaque utilisateur ne voit que ses lignes.
-- À exécuter dans le SQL Editor de ton projet Supabase.

-- ─────────────────────────────────────────────────────────────
-- profiles : miroir applicatif de auth.users
-- ─────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_url   text,
  locale       text        not null default 'fr',
  timezone     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- block_rules : une règle de blocage (type + apps + config)
-- ─────────────────────────────────────────────────────────────
create type public.block_rule_type as enum ('progressive_delay', 'schedule', 'daily_limit');

create table if not exists public.block_rules (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  type          public.block_rule_type not null,
  -- Labels des apps suggérées choisies + référence au token FamilyActivitySelection
  -- (le token réel est opaque + local à l'appareil, conservé en MMKV).
  app_selection jsonb not null default '{}'::jsonb,
  -- Selon type : {base_delay_sec} | {schedule:{start,end,days}} | {max_opens}
  config        jsonb not null default '{}'::jsonb,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists block_rules_user_idx on public.block_rules (user_id);

-- ─────────────────────────────────────────────────────────────
-- block_events : événements remontés des extensions (via App Group)
-- ─────────────────────────────────────────────────────────────
create type public.block_event_type as enum ('intercepted', 'opened_anyway', 'delay_shown');

create table if not exists public.block_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  rule_id     uuid references public.block_rules (id) on delete set null,
  app_label   text,
  type        public.block_event_type not null,
  occurred_at timestamptz not null default now(),
  metadata    jsonb not null default '{}'::jsonb
);

create index if not exists block_events_user_time_idx on public.block_events (user_id, occurred_at desc);

-- ─────────────────────────────────────────────────────────────
-- daily_stats : agrégat par jour (alimente Accueil + Activité)
-- ─────────────────────────────────────────────────────────────
create table if not exists public.daily_stats (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references auth.users (id) on delete cascade,
  date               date not null,
  interceptions_count integer not null default 0,
  opens_stopped      integer not null default 0,
  time_saved_minutes integer not null default 0,
  streak_respected   boolean not null default false,
  unique (user_id, date)
);

-- ─────────────────────────────────────────────────────────────
-- settings : préférences utilisateur
-- ─────────────────────────────────────────────────────────────
create table if not exists public.settings (
  user_id              uuid primary key references auth.users (id) on delete cascade,
  theme                text    not null default 'dark',
  notifications_enabled boolean not null default true,
  reminder_time        time,
  updated_at           timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table public.profiles     enable row level security;
alter table public.block_rules  enable row level security;
alter table public.block_events enable row level security;
alter table public.daily_stats  enable row level security;
alter table public.settings     enable row level security;

-- Politique générique : l'utilisateur gère uniquement ses propres lignes.
create policy "own_profile"  on public.profiles     for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own_rules"    on public.block_rules  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_events"   on public.block_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_stats"    on public.daily_stats  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_settings" on public.settings     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Crée automatiquement profile + settings à l'inscription.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id) values (new.id) on conflict do nothing;
  insert into public.settings (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
