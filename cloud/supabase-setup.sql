-- ============================================================
-- cloud/supabase-setup.sql
-- Mise en place de la base centralisée pour l'application
-- Gestion Hospitaliere (mode cloud).
--
-- PROCEDURE :
--   1. Creez un projet Supabase (plan gratuit) : https://supabase.com
--   2. Onglet "SQL Editor" -> New query
--   3. Collez CE script, REMPLACEZ la cle secrete provisoire
--      (ligne "REMPLACEZ_PAR_VOTRE_CLE_SECRETE") par une longue
--      chaîne aléatoire de votre choix, puis "Run".
--   4. Copiez dans js/config.js :
--        MODE           : 'cloud'
--        SUPABASE_URL   : Parametres du projet -> API -> Project URL
--        SUPABASE_ANON_KEY : Parametres -> API -> anon public
--        APP_SECRET     : la cle secrete choisie ci-dessus.
-- ============================================================

-- ---------- 1. Table des enregistrements ----------
create table if not exists public.records (
    store      text        not null,          -- ex: 'patients', 'tarifs', 'factures'
    id         text        not null,          -- cle primaire de l'objet (ou 'cle' pour 'parametres')
    data       jsonb       not null default '{}'::jsonb,
    updated_at timestamptz not null default now(),
    primary key (store, id)
);

create index if not exists records_store_idx      on public.records (store);
create index if not exists records_store_upd_idx  on public.records (store, updated_at);

alter table public.records enable row level security;

-- ---------- 2. Table de configuration (secret d'acces) ----------
create table if not exists public.app_config (
    cle    text primary key,
    valeur text
);

alter table public.app_config enable row level security;

-- Aucune politique sur app_config => seul la fonction SQL ci-dessous
-- peut la lire (security definer execute en tant que proprietaire).

-- ---------- 3. Verification du secret d'acces ----------
create or replace function public.check_app_secret()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
    select exists (
        select 1 from public.app_config
        where cle = 'app_secret'
          and valeur = coalesce(current_setting('request.headers.x-app-secret', true), '')
    );
$$;

-- ---------- 4. Droits d'acces ----------
grant usage on schema public to anon, authenticated;
grant all on public.records to anon, authenticated;
grant all on public.app_config to anon, authenticated;
grant execute on function public.check_app_secret() to anon, authenticated;

-- Toutes les operations necessitent le secret correct dans l'en-tete
-- HTTP "x-app-secret" de chaque requete (envoye automatiquement par
-- l'application si APP_CONFIG.APP_SECRET est renseigne).
create policy records_select on public.records
    for select using (public.check_app_secret());
create policy records_insert on public.records
    for insert with check (public.check_app_secret());
create policy records_update on public.records
    for update using (public.check_app_secret()) with check (public.check_app_secret());
create policy records_delete on public.records
    for delete using (public.check_app_secret());

-- ---------- 5. Secret initial ----------
-- IMPORTANT : remplacez la valeur ci-dessous AVANT de lancer.
-- Elle doit correspondre exactement a APP_CONFIG.APP_SECRET.
-- Pour la changer plus tard (rotation) :
--   update public.app_config set valeur = 'NOUVELLE_CLE' where cle='app_secret';
insert into public.app_config (cle, valeur)
values ('app_secret', 'REMPLACEZ_PAR_VOTRE_CLE_SECRETE')
on conflict (cle) do nothing;