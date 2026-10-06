-- =====================================================================
--  todomk · modul ZNALOSTI (knowledge base)
--  Spustit jednou v Supabase → SQL Editor → New query → vložit → Run.
--  Zakládá jen NOVÉ tabulky/funkce (kb_*). Úkoly, komentáře k úkolům
--  ani revize projektů nemění. Při opakovaném spuštění skončí chybou
--  "already exists" – to je v pořádku, nic se nepoškodí.
-- =====================================================================
create extension if not exists unaccent with schema extensions;

-- fulltext: čeština bez ohledu na diakritiku a velikost písmen
do $$ begin
  if not exists (select 1 from pg_ts_config where cfgname='kb_cs') then
    create text search configuration public.kb_cs (copy = pg_catalog.simple);
    alter text search configuration public.kb_cs
      alter mapping for hword, hword_part, word, asciiword, asciihword, hword_asciipart
      with extensions.unaccent, pg_catalog.simple;
  end if;
end $$;

create or replace function public.kb_norm(t text) returns text
language sql immutable parallel safe set search_path = extensions, public as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t,'')))
$$;

-- ---------- poznámky ----------
create table public.kb_notes (
  id uuid primary key default gen_random_uuid(),
  title text not null default '' check (length(title) <= 300),
  body text not null default '' check (length(body) <= 500000),
  kind text not null default 'poznamka' check (kind in ('poznamka','schuzka','postup','rozhodnuti','kontakt','napad')),
  folder text not null default '' check (length(folder) <= 200),
  tags text[] not null default '{}',
  owner uuid not null default auth.uid() references auth.users(id),
  owner_name text not null default '',
  visibility text not null default 'private' check (visibility in ('private','team','people')),
  readers text[] not null default '{}',
  editors text[] not null default '{}',
  team_edit boolean not null default false,
  archived boolean not null default false,
  meeting_date date,
  attendees text[] not null default '{}',
  source text not null default 'manual' check (length(source) <= 40),
  source_ref text check (length(source_ref) <= 300),
  task_ids text[] not null default '{}',
  links text[] not null default '{}',
  title_norm text not null default '',
  fts tsvector,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by text
);
create index kb_notes_fts_idx on public.kb_notes using gin (fts);
create index kb_notes_links_idx on public.kb_notes using gin (links);
create index kb_notes_tasks_idx on public.kb_notes using gin (task_ids);
create index kb_notes_updated_idx on public.kb_notes (updated_at desc);
create index kb_notes_owner_idx on public.kb_notes (owner);
create unique index kb_notes_source_ref_idx on public.kb_notes (source, source_ref) where source_ref is not null;

-- ---------- historie verzí ----------
create table public.kb_versions (
  id bigint generated always as identity primary key,
  note_id uuid not null references public.kb_notes(id) on delete cascade,
  title text not null default '',
  body text not null default '',
  edited_by text,
  edited_at timestamptz,
  saved_at timestamptz not null default now()
);
create index kb_versions_note_idx on public.kb_versions (note_id, saved_at desc);

-- ---------- komentáře (k celé poznámce i k označené pasáži) ----------
create table public.kb_comments (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.kb_notes(id) on delete cascade,
  parent_id uuid references public.kb_comments(id) on delete cascade,
  author_id uuid not null default auth.uid() references auth.users(id),
  author_name text not null default public.my_name(),
  body text not null check (length(btrim(body)) > 0 and length(body) <= 10000),
  quote text check (length(quote) <= 1000),
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index kb_comments_note_idx on public.kb_comments (note_id, created_at);
create index kb_comments_parent_idx on public.kb_comments (parent_id);
create index kb_comments_author_idx on public.kb_comments (author_id);

-- ---------- přečteno / připnuto (osobní, každý uživatel zvlášť) ----------
create table public.kb_seen (
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  note_id uuid not null references public.kb_notes(id) on delete cascade,
  seen_at timestamptz not null default now(),
  pinned boolean not null default false,
  primary key (user_id, note_id)
);
create index kb_seen_note_idx on public.kb_seen (note_id);

-- ---------- oprávnění ----------
create or replace function public.kb_can_read_id(nid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from kb_notes n where n.id = nid and (
    n.owner = auth.uid() or n.visibility = 'team'
    or (n.visibility = 'people' and public.my_name() = any (n.readers || n.editors))))
$$;
create or replace function public.kb_can_edit_id(nid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from kb_notes n where n.id = nid and (
    n.owner = auth.uid()
    or (n.visibility = 'people' and public.my_name() = any (n.editors))
    or (n.visibility = 'team' and (n.team_edit or public.my_name() = any (n.editors)))))
$$;

-- ---------- trigger: odvozená pole, verze, ochrana sdílení ----------
create or replace function public.kb_notes_before() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := auth.uid(); me text := public.my_name(); clean text;
begin
  if tg_op = 'INSERT' then
    if uid is not null then new.owner := uid; new.owner_name := coalesce(me, new.owner_name); end if;
    new.version := 1; new.created_at := now();
  else
    if uid is not null then
      if old.owner <> uid and (new.visibility is distinct from old.visibility or new.readers is distinct from old.readers
          or new.editors is distinct from old.editors or new.team_edit is distinct from old.team_edit) then
        raise exception 'Sdílení může měnit jen autor poznámky' using errcode = '42501';
      end if;
      new.owner := old.owner; new.owner_name := old.owner_name;
    end if;
    new.created_at := old.created_at;
    new.version := old.version + 1;
    if (new.body is distinct from old.body or new.title is distinct from old.title)
       and length(old.body) > 0
       and (old.updated_by is distinct from coalesce(me, new.updated_by) or old.updated_at < now() - interval '15 minutes') then
      insert into kb_versions (note_id, title, body, edited_by, edited_at)
      values (old.id, old.title, old.body, old.updated_by, old.updated_at);
      delete from kb_versions where note_id = old.id and id not in
        (select id from kb_versions where note_id = old.id order by saved_at desc limit 60);
    end if;
  end if;
  new.updated_at := now();
  if me is not null then new.updated_by := me; end if;
  if new.visibility = 'private' then new.readers := '{}'; new.editors := '{}'; new.team_edit := false; end if;
  new.readers := coalesce(array(select distinct btrim(x) from unnest(new.readers) x where btrim(x) <> ''), '{}');
  new.editors := coalesce(array(select distinct btrim(x) from unnest(new.editors) x where btrim(x) <> ''), '{}');
  new.tags := coalesce(array(select distinct btrim(x) from unnest(new.tags) x where btrim(x) <> ''), '{}');
  new.attendees := coalesce(array(select distinct btrim(x) from unnest(new.attendees) x where btrim(x) <> ''), '{}');
  new.folder := btrim(regexp_replace(coalesce(new.folder,''), '\s*/\s*', '/', 'g'), '/ ');
  new.title_norm := public.kb_norm(btrim(new.title));
  new.links := coalesce(array(
      select distinct public.kb_norm(btrim(split_part(m[1], '|', 1)))
      from regexp_matches(new.body, '\[\[([^\]\n]{1,200})\]\]', 'g') m
      where btrim(split_part(m[1], '|', 1)) <> ''), '{}');
  new.task_ids := coalesce(array(
      select distinct m[1] from regexp_matches(new.body, '\{\{ukol:([A-Za-z0-9_-]{1,64})\}\}', 'g') m), '{}');
  clean := regexp_replace(new.body, '\{\{ukol:[^}]*\}\}|\(https://kb\.local/[^)]*\)', ' ', 'g');
  new.fts := setweight(to_tsvector('public.kb_cs', coalesce(new.title,'')), 'A')
          || setweight(to_tsvector('public.kb_cs', array_to_string(new.tags,' ') || ' ' || replace(new.folder,'/',' ')
                                    || ' ' || array_to_string(new.attendees,' ')), 'B')
          || setweight(to_tsvector('public.kb_cs', left(clean, 400000)), 'C');
  return new;
end $$;
create trigger kb_notes_before before insert or update on public.kb_notes
  for each row execute function public.kb_notes_before();

-- cizí komentář smí ostatní jen označit jako vyřešený
create or replace function public.kb_comments_guard() returns trigger
language plpgsql set search_path = public as $$
begin
  if auth.uid() is not null and old.author_id <> auth.uid() then
    if new.body is distinct from old.body or new.quote is distinct from old.quote
       or new.note_id is distinct from old.note_id or new.author_id is distinct from old.author_id then
      raise exception 'Cizí komentář nelze upravit' using errcode = '42501';
    end if;
  end if;
  new.author_id := old.author_id; new.author_name := old.author_name; new.created_at := old.created_at;
  return new;
end $$;
create trigger kb_comments_guard before update on public.kb_comments
  for each row execute function public.kb_comments_guard();

-- text bez značek (pro výtah v seznamu a úryvky ve výsledcích hledání)
create or replace function public.kb_plain(t text) returns text
language sql immutable set search_path = public as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(coalesce(t,''), '\{\{ukol:[^}]*\}\}|!?\[[^\]]*\]\(https://kb\.local/[^)]*\)', ' ', 'g'),
             '\[\[([^\]|\n]*)\|([^\]\n]*)\]\]', '\2', 'g'),
           '\[\[|\]\]|[#>*_`~|]+|^\s*(?:[-+]|\d+[.)])\s+(?:\[[ xX]\]\s*)?', '', 'gn')
$$;

-- výtah textu do seznamu (PostgREST: select=...,kb_excerpt)
create or replace function public.kb_excerpt(public.kb_notes) returns text
language sql stable set search_path = public as $$
  select left(btrim(regexp_replace(public.kb_plain($1.body), '\s+', ' ', 'g')), 240)
$$;

-- ---------- RLS ----------
alter table public.kb_notes enable row level security;
alter table public.kb_versions enable row level security;
alter table public.kb_comments enable row level security;
alter table public.kb_seen enable row level security;

create policy kb_notes_read on public.kb_notes for select to authenticated using (
  owner = (select auth.uid()) or visibility = 'team'
  or (visibility = 'people' and (select public.my_name()) = any (readers || editors)));
create policy kb_notes_insert on public.kb_notes for insert to authenticated
  with check (owner = (select auth.uid()));
create policy kb_notes_update on public.kb_notes for update to authenticated using (
  owner = (select auth.uid())
  or (visibility = 'people' and (select public.my_name()) = any (editors))
  or (visibility = 'team' and (team_edit or (select public.my_name()) = any (editors))))
  with check (owner = (select auth.uid()) or visibility in ('team','people'));
create policy kb_notes_delete on public.kb_notes for delete to authenticated
  using (owner = (select auth.uid()));

create policy kb_versions_read on public.kb_versions for select to authenticated
  using (public.kb_can_read_id(note_id));

create policy kb_comments_read on public.kb_comments for select to authenticated
  using (public.kb_can_read_id(note_id));
create policy kb_comments_insert on public.kb_comments for insert to authenticated
  with check (author_id = (select auth.uid()) and author_name = (select public.my_name()) and public.kb_can_read_id(note_id));
create policy kb_comments_update on public.kb_comments for update to authenticated
  using (author_id = (select auth.uid()) or public.kb_can_edit_id(note_id))
  with check (public.kb_can_read_id(note_id));
create policy kb_comments_delete on public.kb_comments for delete to authenticated
  using (author_id = (select auth.uid()) or exists (select 1 from public.kb_notes n where n.id = note_id and n.owner = (select auth.uid())));

create policy kb_seen_own on public.kb_seen for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- ---------- vyhledávání v poznámkách i úkolech ----------
create or replace function public.kb_search(q text, lim integer default 40)
returns table (res_type text, id text, title text, snippet text, rank real, updated_at timestamptz, info jsonb)
language plpgsql stable security invoker set search_path = public, extensions as $$
declare tsq tsquery; opts text := 'MaxFragments=2, MaxWords=22, MinWords=8, StartSel=⟦, StopSel=⟧, FragmentDelimiter=" … "';
begin
  -- slova bez diakritiky, zkrácená o běžné české koncovky (obce/obci/obcí), hledá se jako začátek slova
  select to_tsquery('public.kb_cs', string_agg(quote_literal(s) || ':*', ' & '))
    into tsq
    from (
      select case when length(w) >= 4
                   and length(regexp_replace(w, '(ami|ach|ech|ich|ovi|em|um|ou|y|a|e|i|o|u)$', '')) >= 3
                  then regexp_replace(w, '(ami|ach|ech|ich|ovi|em|um|ou|y|a|e|i|o|u)$', '') else w end as s
        from (select public.kb_norm(x) as w
                from regexp_split_to_table(btrim(coalesce(q,'')), '[\s,.;:!?()"''„“”\[\]{}<>/\\|+=*&^%$#@~`-]+') x
               where x <> '') a
    ) b
   where s <> '';
  if tsq is null or tsq::text = '' then return; end if;
  return query
  select * from (
    select 'note'::text, n.id::text, n.title,
           ts_headline('public.kb_cs', public.kb_plain(n.body), tsq, opts),
           (ts_rank(n.fts, tsq) + case when to_tsvector('public.kb_cs', n.title) @@ tsq then 1 else 0 end)::real,
           n.updated_at,
           jsonb_build_object('kind', n.kind, 'folder', n.folder, 'owner_name', n.owner_name, 'visibility', n.visibility, 'archived', n.archived, 'tags', n.tags)
      from public.kb_notes n
     where n.fts @@ tsq
    union all
    select 'task'::text, t.id, t.title,
           ts_headline('public.kb_cs', coalesce(t.note,''), tsq, opts),
           (ts_rank(to_tsvector('public.kb_cs', t.title || ' ' || coalesce(t.note,'')), tsq) * 0.8
             + case when to_tsvector('public.kb_cs', t.title) @@ tsq then 1 else 0 end)::real,
           t.updated_at,
           jsonb_build_object('done', t.done, 'due', t.due, 'owner_name', t.owner_name, 'assignees', t.assignees)
      from public.tasks t
     where to_tsvector('public.kb_cs', t.title || ' ' || coalesce(t.note,'')) @@ tsq
  ) r
  order by 5 desc, 6 desc
  limit greatest(1, least(coalesce(lim, 40), 200));
end $$;

-- ---------- přílohy (soukromý bucket, přístup podle sdílení poznámky) ----------
insert into storage.buckets (id, name, public, file_size_limit)
values ('kb', 'kb', false, 26214400)
on conflict (id) do nothing;

create policy kb_files_read on storage.objects for select to authenticated using (
  bucket_id = 'kb' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and public.kb_can_read_id(((storage.foldername(name))[1])::uuid));
create policy kb_files_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'kb' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and public.kb_can_edit_id(((storage.foldername(name))[1])::uuid));
create policy kb_files_delete on storage.objects for delete to authenticated using (
  bucket_id = 'kb' and (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
  and public.kb_can_edit_id(((storage.foldername(name))[1])::uuid));

revoke execute on function public.kb_search(text, integer) from anon, public;
grant execute on function public.kb_search(text, integer) to authenticated;
revoke execute on function public.kb_can_read_id(uuid) from anon, public;
grant execute on function public.kb_can_read_id(uuid) to authenticated;
revoke execute on function public.kb_can_edit_id(uuid) from anon, public;
grant execute on function public.kb_can_edit_id(uuid) to authenticated;

-- ---------- e-mailové upozornění (Edge Function notify-kb) ----------
-- Komentář → autor, editoři, dřívější komentující a @zmínění. Sdílení vybraným lidem → nově přidaní.
-- Dokud funkce notify-kb není nasazená, volání tiše selže a nic dalšího neovlivní.
create or replace function public.notify_kb_changed() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_table_name = 'kb_notes' then
    if new.visibility <> 'people' then return new; end if;
    if tg_op = 'UPDATE' and new.visibility = old.visibility
       and new.readers is not distinct from old.readers and new.editors is not distinct from old.editors then
      return new;
    end if;
  end if;
  perform net.http_post(
    url := 'https://ymjedsrhsbkiipnpfwlm.supabase.co/functions/v1/notify-kb',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InltamVkc3Joc2JraWlwbnBmd2xtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMxNjcwMjYsImV4cCI6MjA5ODc0MzAyNn0.rszr0ZdyWtESBp2KXmLgVnEYNn50c8XMa4x2sSXVQ9o',
      'x-hook-secret', (select value from private.settings where key = 'hook_secret')),
    body := jsonb_build_object(
      'type', tg_op, 'table', tg_table_name,
      'record', case when tg_table_name = 'kb_notes' then to_jsonb(new) - 'body' - 'fts' else to_jsonb(new) end,
      'old_record', case when tg_op = 'UPDATE' then to_jsonb(old) - 'body' - 'fts' else null end));
  return new;
end $$;
create trigger kb_notes_notify after insert or update of visibility, readers, editors on public.kb_notes
  for each row execute function public.notify_kb_changed();
create trigger kb_comments_notify after insert on public.kb_comments
  for each row execute function public.notify_kb_changed();
