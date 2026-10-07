-- =====================================================================
--  todomk · stavy řešitelů (spuštěno 7. 10. 2026)
--  meta.st[jméno]  = stav úkolu u řešitele (převzato / hotovo + jeho sloupec)
--  meta.cols[jméno]= sloupec úkolu na nástěnce řešitele
--  meta.rv/back/pc = autor: přesunuto ke kontrole / vráceno / původní sloupec
--  Trigger zajistí, že nikdo nepřepíše cizí stav starou kopií dat.
-- =====================================================================
create or replace function public.tasks_meta_merge() returns trigger
language plpgsql set search_path = public as $$
declare w text := new.updated_by; o jsonb := coalesce(old.meta,'{}'::jsonb); n jsonb := coalesce(new.meta,'{}'::jsonb); k text; merged jsonb;
begin
  -- meta.st a meta.cols: každý smí měnit jen svůj klíč (podle updated_by), zbytek se převezme z DB
  foreach k in array array['st','cols'] loop
    merged := coalesce(o->k, '{}'::jsonb);
    if jsonb_typeof(merged) <> 'object' then merged := '{}'::jsonb; end if;
    if w is not null and w <> '' then
      if jsonb_typeof(n->k) = 'object' and (n->k) ? w then merged := merged || jsonb_build_object(w, n->k->w);
      else merged := merged - w; end if;
    end if;
    n := jsonb_set(n, array[k], merged, true);
  end loop;
  -- meta.rv / back / pc smí měnit jen autor úkolu
  if w is distinct from old.owner_name then
    n := n - 'rv' - 'back' - 'pc';
    if o ? 'rv' then n := jsonb_set(n, '{rv}', o->'rv', true); end if;
    if o ? 'back' then n := jsonb_set(n, '{back}', o->'back', true); end if;
    if o ? 'pc' then n := jsonb_set(n, '{pc}', o->'pc', true); end if;
  end if;
  new.meta := n;
  return new;
end $$;
create trigger tasks_meta_merge before update on public.tasks
  for each row execute function public.tasks_meta_merge();
