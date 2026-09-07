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
  -- Date de naissance : une DATE, jamais un timestamp. Un anniversaire n'a
  -- pas d'heure, et le faire transiter en UTC le décale d'un jour pour la
  -- moitié de la planète.
  birth_date   date,
  locale       text        not null default 'fr',
  timezone     text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Ajout après coup sur une base déjà déployée (2026-09-07).
alter table public.profiles add column if not exists birth_date date;

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
-- onboarding_answers : les réponses du questionnaire d'accueil
-- (déclencheur, apps, moment, ressentis, heures/jour…). Elles nourrissent
-- le plan personnalisé et survivent ainsi à une réinstallation.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.onboarding_answers (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  answers    jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- Row Level Security
-- ─────────────────────────────────────────────────────────────
alter table public.profiles     enable row level security;
alter table public.block_rules  enable row level security;
alter table public.block_events enable row level security;
alter table public.daily_stats  enable row level security;
alter table public.settings     enable row level security;
alter table public.onboarding_answers enable row level security;

-- Politique générique : l'utilisateur gère uniquement ses propres lignes.
create policy "own_profile"  on public.profiles     for all using (auth.uid() = id)      with check (auth.uid() = id);
create policy "own_rules"    on public.block_rules  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_events"   on public.block_events for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_stats"    on public.daily_stats  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_settings" on public.settings     for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own_onboarding_answers" on public.onboarding_answers for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Crée automatiquement profile + settings à l'inscription.
--
-- `search_path = ''` plutôt que `= public` : une fonction SECURITY DEFINER
-- s'exécute avec les droits de son PROPRIÉTAIRE (ici le superutilisateur), donc
-- tout nom non qualifié qu'elle résout est un nom qu'un attaquant capable de
-- créer un objet homonyme plus tôt dans le chemin détournerait avec ces droits.
-- Le chemin vide supprime la question : plus rien n'est implicite, chaque table
-- est nommée `public.…` en toutes lettres (les fonctions natives comme `now()`
-- restent joignables, `pg_catalog` étant toujours consulté d'office).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
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

-- ─────────────────────────────────────────────────────────────
-- upload_grants : garde-fou de débit sur les autorisations ImageKit
-- ─────────────────────────────────────────────────────────────
-- POURQUOI
-- `imagekit-auth` signe un upload sans pouvoir en contraindre le contenu : la
-- signature ImageKit couvre `token + expire`, jamais le fichier. Un compte
-- authentifié pourrait donc demander des autorisations en boucle et remplir la
-- médiathèque — la facture est au stockage, pas à l'utilisateur.
--
-- Le compteur vit donc côté serveur, dans une fenêtre glissante par personne.
-- Aucune politique RLS : la table n'est JAMAIS lue ni écrite par le client,
-- seule l'Edge Function (service role, qui contourne RLS) y touche.
create table if not exists public.upload_grants (
  user_id           uuid primary key references auth.users (id) on delete cascade,
  window_started_at timestamptz not null default now(),
  grant_count       integer     not null default 0
);

alter table public.upload_grants enable row level security;

-- Réclame une autorisation et dit si elle est accordée.
--
-- ATOMIQUE À DESSEIN : lire puis écrire depuis l'Edge Function laisserait deux
-- requêtes simultanées passer la même vérification. Tout se joue donc dans un
-- seul `insert … on conflict`, où PostgreSQL verrouille la ligne.
create or replace function public.claim_upload_grant(
  p_user_id        uuid,
  p_max_grants     integer,
  p_window_seconds integer
) returns boolean
-- Chemin de recherche vide, même raison que `handle_new_user` ci-dessus.
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  insert into public.upload_grants as g (user_id, window_started_at, grant_count)
  values (p_user_id, now(), 1)
  on conflict (user_id) do update
    -- Fenêtre expirée : on repart à zéro. Sinon on incrémente celle en cours.
    set window_started_at = case
          when g.window_started_at < now() - make_interval(secs => p_window_seconds)
          then now()
          else g.window_started_at
        end,
        grant_count = case
          when g.window_started_at < now() - make_interval(secs => p_window_seconds)
          then 1
          else g.grant_count + 1
        end
  returning g.grant_count into v_count;

  return v_count <= p_max_grants;
end;
$$;

-- Appelée UNIQUEMENT par l'Edge Function : `p_user_id` n'est pas vérifié ici,
-- c'est l'appelant qui l'a établi à partir du JWT. Exposer cette fonction au
-- rôle `authenticated` laisserait n'importe qui consommer le quota d'autrui.
revoke all on function public.claim_upload_grant(uuid, integer, integer) from public;
revoke all on function public.claim_upload_grant(uuid, integer, integer) from anon;
revoke all on function public.claim_upload_grant(uuid, integer, integer) from authenticated;
grant execute on function public.claim_upload_grant(uuid, integer, integer) to service_role;
