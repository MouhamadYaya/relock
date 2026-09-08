-- ═══════════════════════════════════════════════════════════════
-- Rattrapage du schéma déployé — projet Relock (fdzbfolhxaytfhwujjxz)
-- ═══════════════════════════════════════════════════════════════
-- Ce fichier ne contient RIEN de nouveau : c'est la partie de
-- supabase/schema.sql qui n'a jamais été appliquée sur la base en ligne,
-- recopiée à l'identique.
--
-- Deux manques constatés le 2026-09-08, par requête sur la base :
--   1. profiles.birth_date            → "column profiles.birth_date does not exist"
--   2. upload_grants + claim_upload_grant → PGRST205 / 404
--
-- Conséquences en production :
--   1. enregistrer une date de naissance échoue (errors.birth_date_unavailable) ;
--   2. imagekit-auth renvoie 503 quota_unavailable à CHAQUE appel — donc
--      l'envoi de photo de profil échoue à 100 %.
--
-- Tout est idempotent (`if not exists`, `or replace`) : le relancer ne casse
-- rien et n'écrase aucune donnée.
-- ═══════════════════════════════════════════════════════════════


-- ─── 1. profiles.birth_date ────────────────────────────────────
-- Une DATE, jamais un timestamp : un anniversaire n'a pas d'heure, et le
-- faire transiter en UTC le décale d'un jour pour la moitié de la planète.
alter table public.profiles add column if not exists birth_date date;


-- ─── 2. upload_grants ──────────────────────────────────────────
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


-- ─── 3. claim_upload_grant ─────────────────────────────────────
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
-- Chemin de recherche vide, même raison que `handle_new_user` : une fonction
-- `security definer` dont le search_path est modifiable est un vecteur
-- d'élévation de privilèges. Tout est donc qualifié en `public.…`.
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
