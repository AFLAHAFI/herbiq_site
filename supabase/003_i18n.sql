-- Migration 003_i18n: Add translations JSONB column to public.herbiq_plants
-- Run as project owner in Supabase SQL Editor. Keep 001_schema.sql and 002_seed.sql untouched.
begin;

-- Verify existing columns: id, qr_id, published, profile, revision, updated_at
alter table public.herbiq_plants
  add column if not exists translations jsonb not null default '{}'::jsonb;

alter table public.herbiq_plants
  drop constraint if exists herbiq_plants_translations_check;

alter table public.herbiq_plants
  add constraint herbiq_plants_translations_check
  check (
    jsonb_typeof(translations) = 'object'
    and pg_column_size(translations) < 200000
    and octet_length(translations::text) < 200000
  );

create or replace function herbiq_private.validate_plant() returns trigger
language plpgsql set search_path = '' as $$
declare
  field text;
  value text;
  lang_key text;
  lang_obj jsonb;
begin
  if TG_OP = 'UPDATE' and new.id <> old.id then
    raise exception 'Plant ID cannot be changed';
  end if;

  foreach field in array array['name','malayalamName','scientificName','family','category','description','traditionalUses','medicinalBenefits','plantPartsTraditionallyUsed','traditionalUsage','habitat','identification','image'] loop
    value := new.profile->>field;
    if jsonb_typeof(new.profile->field) is distinct from 'string' or value is null or length(trim(value)) = 0 or length(value) > 5000 then
      raise exception 'Invalid required field: %', field;
    end if;
  end loop;

  foreach field in array array['issues','symptoms','prevention'] loop
    value := new.profile->'health'->>field;
    if jsonb_typeof(new.profile->'health'->field) is distinct from 'string' or value is null or length(trim(value)) = 0 or length(value) > 5000 then
      raise exception 'Invalid health field: %', field;
    end if;
  end loop;

  if jsonb_typeof(new.profile->'arAvailable') is distinct from 'boolean' then
    raise exception 'Invalid AR availability';
  end if;

  if (new.profile->>'arAvailable')::boolean and coalesce(new.profile->>'model3D','') = '' then
    raise exception 'A model URL is required for AR';
  end if;

  foreach field in array array['image','model3D'] loop
    value := coalesce(new.profile->>field,'');
    if value <> '' and not (value ~ '^https://[^[:space:]]+$' or (value ~ '^/assets/[A-Za-z0-9/_ .-]+$' and position('..' in value) = 0)) then
      raise exception 'Invalid asset URL';
    end if;
  end loop;

  -- Sync translations between profile->'translations' and translations column if one was provided
  if new.translations is null then
    new.translations := '{}'::jsonb;
  end if;
  if new.translations = '{}'::jsonb and (new.profile ? 'translations') and jsonb_typeof(new.profile->'translations') = 'object' then
    new.translations := new.profile->'translations';
  end if;

  if jsonb_typeof(new.translations) is distinct from 'object' or pg_column_size(new.translations) >= 200000 or octet_length(new.translations::text) >= 200000 then
    raise exception 'Invalid translations object or size exceeds limit';
  end if;

  for lang_key, lang_obj in select * from jsonb_each(new.translations) loop
    if lang_key !~ '^[a-z]{2,5}(-[A-Za-z0-9]{2,8})?$' then
      raise exception 'Invalid translation language code: %', lang_key;
    end if;
    if jsonb_typeof(lang_obj) is distinct from 'object' then
      raise exception 'Translation entry for % must be a JSON object', lang_key;
    end if;
    foreach field in array array['name','category','description','traditionalUses','medicinalBenefits','plantPartsTraditionallyUsed','traditionalUsage','habitat','identification','culturalImportance'] loop
      if lang_obj ? field and lang_obj->field is not null and jsonb_typeof(lang_obj->field) <> 'null' then
        if jsonb_typeof(lang_obj->field) is distinct from 'string' or length(lang_obj->>field) > 5000 then
          raise exception 'Invalid translated field %.%', lang_key, field;
        end if;
      end if;
    end loop;
    if lang_obj ? 'uses' and lang_obj->'uses' is not null and jsonb_typeof(lang_obj->'uses') <> 'null' then
      if jsonb_typeof(lang_obj->'uses') is distinct from 'array' then
        raise exception 'Invalid translated uses array for %', lang_key;
      end if;
    end if;
    if lang_obj ? 'health' and lang_obj->'health' is not null and jsonb_typeof(lang_obj->'health') <> 'null' then
      if jsonb_typeof(lang_obj->'health') is distinct from 'object' then
        raise exception 'Invalid translated health object for %', lang_key;
      end if;
      foreach field in array array['issues','symptoms','prevention'] loop
        if (lang_obj->'health') ? field and (lang_obj->'health'->field) is not null and jsonb_typeof(lang_obj->'health'->field) <> 'null' then
          if jsonb_typeof(lang_obj->'health'->field) is distinct from 'string' or length(lang_obj->'health'->>field) > 5000 then
            raise exception 'Invalid translated health field %.%', lang_key, field;
          end if;
        end if;
      end loop;
    end if;
  end loop;

  -- Keep profile.translations mirrored so legacy selects on profile still include translations
  new.profile := jsonb_set(new.profile, '{translations}', new.translations, true);

  new.revision := case when TG_OP = 'INSERT' then 1 else old.revision + 1 end;
  new.updated_at := now();
  return new;
end $$;

-- Re-ensure RLS policies cover public read of published rows and admin-only write
alter table public.herbiq_plants enable row level security;
drop policy if exists herbiq_read on public.herbiq_plants;
create policy herbiq_read on public.herbiq_plants for select to anon, authenticated using (published or (select public.herbiq_is_admin()));
drop policy if exists herbiq_insert on public.herbiq_plants;
create policy herbiq_insert on public.herbiq_plants for insert to authenticated with check ((select public.herbiq_is_admin()));
drop policy if exists herbiq_update on public.herbiq_plants;
create policy herbiq_update on public.herbiq_plants for update to authenticated using ((select public.herbiq_is_admin())) with check ((select public.herbiq_is_admin()));
drop policy if exists herbiq_delete on public.herbiq_plants;
create policy herbiq_delete on public.herbiq_plants for delete to authenticated using ((select public.herbiq_is_admin()));

commit;
