-- ═══════════════════════════════════════════════════════════════
-- apple_revocation_audit — à appliquer sur la base en ligne
-- Projet Relock (fdzbfolhxaytfhwujjxz) · 2026-09-08
-- ═══════════════════════════════════════════════════════════════
-- Ce fichier ne contient RIEN de nouveau : c'est le bloc ajouté à
-- `supabase/schema.sql` le 2026-09-08, recopié à l'identique pour être collé
-- dans le SQL Editor du dashboard (ou passé à `psql`).
--
-- POURQUOI MAINTENANT
-- Les quatre secrets `APPLE_*` sont bien posés et Apple accepte la
-- configuration (`npm run check:apple`, 2026-09-08). Mais rien n'empêche ça de
-- re-casser en silence : `delete-account` n'échoue jamais sur une révocation
-- ratée, et sa seule trace est un `console.error` sur un compte qui n'existe
-- plus. Cette table est le compteur qui rend la panne AUDIBLE après coup.
--
-- Tout est idempotent (`if not exists`, `or replace`) : le relancer ne casse
-- rien et n'écrase aucune donnée.
--
-- APRÈS L'AVOIR APPLIQUÉ :
--   supabase functions deploy delete-account
-- (sans ce redéploiement, la table reste vide — c'est la fonction qui écrit.)
--
-- POUR LIRE LE COMPTEUR ENSUITE :
--   select * from public.apple_revocation_audit order by day desc;
-- Tout ce qui n'est ni `revoked` ni `no_token` est un compte supprimé chez
-- nous mais toujours listé dans « Connexion avec Apple » côté utilisateur —
-- c'est-à-dire un motif de rejet 5.1.1(v) qui dort.
-- ═══════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- apple_revocation_audit : rendre AUDIBLE un échec de révocation
-- ─────────────────────────────────────────────────────────────
-- POURQUOI
-- `delete-account` ne fait jamais échouer une suppression parce qu'Apple a mal
-- répondu : le droit à l'effacement passe avant l'hygiène qu'on doit à Apple.
-- Le prix de cet arbitrage, c'est le silence. Une clé `.p8` tournée sans être
-- repoussée, un Team ID recopié de travers, et la révocation cesse de marcher
-- sans que RIEN ne le dise : la seule trace est une ligne de journal, écrite
-- au moment d'une suppression — c'est-à-dire là où personne ne regarde, sur un
-- compte qui n'existe déjà plus. Les journaux Supabase, eux, expirent.
--
-- Cette table est le compteur qui manquait. Elle répond à une seule question,
-- mais on ne pouvait pas y répondre du tout : « combien de comptes ont été
-- supprimés sans que le jeton Apple soit révoqué ? »
--
-- AUCUN IDENTIFIANT, ET C'EST LE POINT DÉLICAT
-- Ces lignes survivent au compte qu'elles décrivent. Y poser un `user_id`
-- reviendrait à garder une trace d'une personne qui vient d'exercer son droit
-- à l'effacement (RGPD art. 17) — exactement ce qu'on efface par ailleurs.
-- Un horodatage à la seconde serait presque aussi bavard : recoupé avec autre
-- chose, il ré-identifie. D'où la forme retenue : un COMPTEUR par jour et par
-- issue. On sait « 3 échecs `missing_secrets` le 12 mars », jamais qui.
--
-- `last_detail` ne contient que le message technique (statut HTTP, code
-- d'erreur Apple), jamais d'identifiant : voir `recordRevocation` dans
-- `supabase/functions/delete-account/index.ts`, qui est le seul écrivain.
--
-- AUCUNE POLITIQUE RLS, comme `upload_grants` et `apple_refresh_tokens` : le
-- client n'a aucune raison de lire ce compteur, et RLS active sans politique
-- refuse tout le monde. Seule l'Edge Function y touche, via la service role.
create table if not exists public.apple_revocation_audit (
  day         date        not null,
  outcome     text        not null,
  count       integer     not null default 0,
  last_detail text,
  updated_at  timestamptz not null default now(),
  primary key (day, outcome),
  -- La liste fermée n'est pas décorative : elle interdit qu'une issue nouvelle
  -- s'ajoute côté Edge Function sans qu'on décide ici de ce qu'elle signifie.
  -- Une issue inconnue ferait échouer l'écriture — qui est déjà, par
  -- construction, sans conséquence sur la suppression.
  constraint apple_revocation_audit_outcome_known check (
    outcome in (
      'revoked',          -- Apple a bien révoqué : le cas nominal.
      'no_token',         -- Rien à révoquer (Google, ou compte pré-`apple-link`).
      'missing_secrets',  -- Secrets APPLE_* absents : la panne invisible.
      'apple_refused',    -- Apple a répondu non (client secret, jeton).
      'read_failed',      -- Lecture du jeton en base impossible.
      'error'             -- Exception réseau ou autre.
    )
  )
);

alter table public.apple_revocation_audit enable row level security;

-- L'incrément doit être ATOMIQUE : deux suppressions simultanées lisant puis
-- réécrivant `count` en perdraient une, et un compteur qui sous-estime les
-- échecs est pire que pas de compteur du tout. D'où l'`on conflict do update`
-- côté base plutôt qu'un lire-modifier-écrire côté Edge Function.
create or replace function public.record_apple_revocation(
  p_outcome text,
  p_detail  text default null
) returns void
-- Chemin de recherche vide, même raison que `claim_upload_grant` ci-dessus.
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.apple_revocation_audit as a (day, outcome, count, last_detail)
  values (current_date, p_outcome, 1, left(p_detail, 200))
  on conflict (day, outcome) do update
    set count       = a.count + 1,
        -- On garde le dernier message plutôt que le premier : quand une
        -- configuration se répare, la ligne du jour cesse de mentir.
        last_detail = coalesce(excluded.last_detail, a.last_detail),
        updated_at  = now();
end;
$$;

-- Appelée UNIQUEMENT par `delete-account`. L'ouvrir à `authenticated`
-- laisserait n'importe qui fabriquer de faux échecs et noyer les vrais.
revoke all on function public.record_apple_revocation(text, text) from public;
revoke all on function public.record_apple_revocation(text, text) from anon;
revoke all on function public.record_apple_revocation(text, text) from authenticated;
grant execute on function public.record_apple_revocation(text, text) to service_role;
