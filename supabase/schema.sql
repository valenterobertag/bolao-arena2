-- =====================================================================
--  Bolão do 5º Torneio de Equipes - Arena Barra Mares
--  Cole este arquivo inteiro no SQL Editor do Supabase e clique em Run.
--  ANTES DE RODAR: troque o código do organizador na linha marcada (1).
-- =====================================================================

-- ---------- Tabelas ----------

create table if not exists public.settings (
  id            int primary key default 1 check (id = 1),
  teams         text[] not null default array['Equipe 1','Equipe 2','Equipe 3','Equipe 4','Equipe 5','Equipe 6','Equipe 7','Equipe 8'],
  cat_deadline  timestamptz,
  cat_closed    boolean not null default false
);
insert into public.settings (id) values (1) on conflict do nothing;

-- Código secreto do organizador (nenhuma policy = ninguém lê pelo app)
create table if not exists public.admin_secret (code text not null);
alter table public.admin_secret enable row level security;
delete from public.admin_secret;
insert into public.admin_secret (code) values ('TROQUE-ESTE-CODIGO');   -- (1) TROQUE AQUI

create table if not exists public.profiles (
  id          uuid primary key references auth.users on delete cascade,
  name        text not null,
  kind        text not null default 'jogador' check (kind in ('jogador','convidado')),
  is_admin    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table if not exists public.players (
  id    text primary key,           -- slug do nome
  name  text not null,
  team  int check (team between 0 and 7)
);

create table if not exists public.matches (
  id         uuid primary key default gen_random_uuid(),
  phase      text not null check (phase in ('R1','R2','R3','R4','SF1','SF2','FINAL')),
  team_a     int  not null check (team_a between 0 and 7),
  team_b     int  not null check (team_b between 0 and 7),
  starts_at  timestamptz,
  closed     boolean not null default false,
  check (team_a <> team_b)
);

create table if not exists public.games (
  id        uuid primary key default gen_random_uuid(),
  match_id  uuid not null references public.matches on delete cascade,
  idx       int  not null,
  winner    text check (winner in ('A','B')),
  unique (match_id, idx)
);

create table if not exists public.game_picks (
  user_id     uuid not null references public.profiles on delete cascade,
  game_id     uuid not null references public.games on delete cascade,
  pick        text not null check (pick in ('A','B')),
  updated_at  timestamptz not null default now(),
  primary key (user_id, game_id)
);

create table if not exists public.cat_results (
  cat    text primary key,
  value  text
);

create table if not exists public.cat_picks (
  user_id     uuid not null references public.profiles on delete cascade,
  cat         text not null,
  value       text not null,
  updated_at  timestamptz not null default now(),
  primary key (user_id, cat)
);

-- ---------- Cada confronto já nasce com seus jogos (4 nas rodadas, 3 na semi e final) ----------

create or replace function public.make_games() returns trigger
language plpgsql security definer set search_path = public as $$
declare n int := case when new.phase in ('R1','R2','R3','R4') then 4 else 3 end; i int;
begin
  for i in 0..n-1 loop
    insert into public.games (match_id, idx) values (new.id, i);
  end loop;
  return new;
end $$;

drop trigger if exists matches_make_games on public.matches;
create trigger matches_make_games after insert on public.matches
  for each row execute function public.make_games();

-- ---------- Funções de apoio ----------

create or replace function public.is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- Palpite de jogo só é aceito se: confronto aberto, horário não passou e jogo sem resultado
create or replace function public.can_pick_game(gid uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.games g join public.matches m on m.id = g.match_id
    where g.id = gid and g.winner is null and not m.closed
      and (m.starts_at is null or m.starts_at > now())
  )
$$;

-- Palpite de categoria só é aceito antes do prazo
create or replace function public.cats_open() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select not cat_closed and (cat_deadline is null or cat_deadline > now())
                   from public.settings where id = 1), true)
$$;

-- Vira organizador quem informar o código correto
create or replace function public.claim_admin(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return false; end if;
  if exists (select 1 from public.admin_secret s where s.code = p_code) then
    update public.profiles set is_admin = true where id = auth.uid();
    return true;
  end if;
  return false;
end $$;

-- Organizador redefine o PIN de alguém para 0000.
-- ATENÇÃO: o texto '-arena5' precisa ser igual ao PIN_SUFFIX em src/rules.js
create or replace function public.admin_reset_pin(target uuid) returns void
language plpgsql security definer set search_path = public, extensions, auth as $$
begin
  if not public.is_admin() then raise exception 'Apenas organizadores podem redefinir PIN'; end if;
  update auth.users set encrypted_password = crypt('0000' || '-arena5', gen_salt('bf')) where id = target;
end $$;

-- ---------- Ranking calculado no banco ----------

create or replace function public.ranking()
returns table (uid uuid, pname text, pkind text, game_hits int, cat_hits int, game_pts int, cat_pts int, total int)
language sql security definer stable set search_path = public as $$
  with cp(cat, pts) as (
    values ('champion',15),('vice',10),('third',7),('fourth',5),
           ('mvp',10),('sidao',5),('checkins',5),('revelacao',5)
  ),
  gh as (
    select gp.user_id, count(*)::int as hits
    from public.game_picks gp join public.games g on g.id = gp.game_id
    where g.winner is not null and g.winner = gp.pick
    group by gp.user_id
  ),
  ch as (
    select p.user_id, count(*)::int as hits, sum(cp.pts)::int as pts
    from public.cat_picks p
    join public.cat_results r on r.cat = p.cat and r.value is not null and r.value = p.value
    join cp on cp.cat = p.cat
    group by p.user_id
  )
  select pr.id, pr.name, pr.kind,
         coalesce(gh.hits, 0), coalesce(ch.hits, 0),
         coalesce(gh.hits, 0) * 3, coalesce(ch.pts, 0),
         coalesce(gh.hits, 0) * 3 + coalesce(ch.pts, 0)
  from public.profiles pr
  left join gh on gh.user_id = pr.id
  left join ch on ch.user_id = pr.id
  order by 8 desc, 4 desc, pr.name
$$;

-- ---------- Segurança (RLS) ----------

alter table public.settings    enable row level security;
alter table public.profiles    enable row level security;
alter table public.players     enable row level security;
alter table public.matches     enable row level security;
alter table public.games       enable row level security;
alter table public.game_picks  enable row level security;
alter table public.cat_results enable row level security;
alter table public.cat_picks   enable row level security;

-- settings
create policy "settings: ler"     on public.settings for select to authenticated using (true);
create policy "settings: editar"  on public.settings for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- profiles (todos veem nomes; ninguém vira admin sozinho)
create policy "profiles: ler"     on public.profiles for select to authenticated using (true);
create policy "profiles: criar o proprio" on public.profiles for insert to authenticated
  with check (id = auth.uid() and is_admin = false);
create policy "profiles: admin edita" on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- players
create policy "players: ler"      on public.players for select to authenticated using (true);
create policy "players: admin cria"   on public.players for insert to authenticated with check (public.is_admin());
create policy "players: admin edita"  on public.players for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "players: admin apaga"  on public.players for delete to authenticated using (public.is_admin());

-- matches
create policy "matches: ler"      on public.matches for select to authenticated using (true);
create policy "matches: admin cria"   on public.matches for insert to authenticated with check (public.is_admin());
create policy "matches: admin edita"  on public.matches for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "matches: admin apaga"  on public.matches for delete to authenticated using (public.is_admin());

-- games (criados pelo trigger; admin lança o vencedor)
create policy "games: ler"        on public.games for select to authenticated using (true);
create policy "games: admin edita" on public.games for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- game_picks: cada um vê e mexe só nos seus, e só antes do horário
create policy "game_picks: ler os meus" on public.game_picks for select to authenticated using (user_id = auth.uid());
create policy "game_picks: criar" on public.game_picks for insert to authenticated
  with check (user_id = auth.uid() and public.can_pick_game(game_id));
create policy "game_picks: mudar" on public.game_picks for update to authenticated
  using (user_id = auth.uid() and public.can_pick_game(game_id))
  with check (user_id = auth.uid() and public.can_pick_game(game_id));
create policy "game_picks: apagar" on public.game_picks for delete to authenticated
  using (user_id = auth.uid() and public.can_pick_game(game_id));

-- cat_results
create policy "cat_results: ler"  on public.cat_results for select to authenticated using (true);
create policy "cat_results: admin cria"  on public.cat_results for insert to authenticated with check (public.is_admin());
create policy "cat_results: admin edita" on public.cat_results for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- cat_picks
create policy "cat_picks: ler os meus" on public.cat_picks for select to authenticated using (user_id = auth.uid());
create policy "cat_picks: criar" on public.cat_picks for insert to authenticated
  with check (user_id = auth.uid() and public.cats_open());
create policy "cat_picks: mudar" on public.cat_picks for update to authenticated
  using (user_id = auth.uid() and public.cats_open())
  with check (user_id = auth.uid() and public.cats_open());
create policy "cat_picks: apagar" on public.cat_picks for delete to authenticated
  using (user_id = auth.uid() and public.cats_open());

-- Permissões das funções chamadas pelo app
revoke all on function public.claim_admin(text) from public, anon;
revoke all on function public.admin_reset_pin(uuid) from public, anon;
revoke all on function public.ranking() from public, anon;
grant execute on function public.claim_admin(text)     to authenticated;
grant execute on function public.admin_reset_pin(uuid) to authenticated;
grant execute on function public.ranking()             to authenticated;
