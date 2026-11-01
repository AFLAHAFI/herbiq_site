-- Run as project owner in Supabase SQL Editor. Do not run with a browser key.
begin;
create schema if not exists herbiq_private;
revoke all on schema herbiq_private from public, anon, authenticated;
create table if not exists herbiq_private.admins (
 user_id uuid primary key references auth.users(id) on delete cascade
);
revoke all on herbiq_private.admins from public, anon, authenticated;
create or replace function public.herbiq_is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
 select exists(select 1 from herbiq_private.admins where user_id = (select auth.uid()));
$$;
revoke all on function public.herbiq_is_admin() from public;
grant execute on function public.herbiq_is_admin() to anon, authenticated;
create table if not exists public.herbiq_plants (
 id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(id) <= 80),
 qr_id text not null unique check (qr_id ~ '^HERBIQ:[a-z0-9]+(-[a-z0-9]+)*$' and length(qr_id) <= 100),
 published boolean not null default false,
 profile jsonb not null check (jsonb_typeof(profile) = 'object' and octet_length(profile::text) < 100000),
 revision integer not null default 1,
 updated_at timestamptz not null default now(),
 check ((profile->>'id') is not null and profile->>'id' = id),
 check ((profile->>'herbiqId') is not null and profile->>'herbiqId' = qr_id)
);
create or replace function herbiq_private.validate_plant() returns trigger language plpgsql set search_path = '' as $$
declare field text; value text;
begin
 if TG_OP = 'UPDATE' and new.id <> old.id then raise exception 'Plant ID cannot be changed'; end if;
 foreach field in array array['name','malayalamName','scientificName','family','category','description','traditionalUses','medicinalBenefits','plantPartsTraditionallyUsed','traditionalUsage','habitat','identification','image'] loop
  value := new.profile->>field;
  if jsonb_typeof(new.profile->field) is distinct from 'string' or value is null or length(trim(value)) = 0 or length(value) > 5000 then raise exception 'Invalid required field: %', field; end if;
 end loop;
 foreach field in array array['issues','symptoms','prevention'] loop
  value := new.profile->'health'->>field;
  if jsonb_typeof(new.profile->'health'->field) is distinct from 'string' or value is null or length(trim(value)) = 0 or length(value)>5000 then raise exception 'Invalid health field: %',field; end if;
 end loop;
 if jsonb_typeof(new.profile->'arAvailable') is distinct from 'boolean' then raise exception 'Invalid AR availability'; end if;
 if (new.profile->>'arAvailable')::boolean and coalesce(new.profile->>'model3D','') = '' then raise exception 'A model URL is required for AR'; end if;
 foreach field in array array['image','model3D'] loop
  value := coalesce(new.profile->>field,'');
  if value <> '' and not (value ~ '^https://[^[:space:]]+$' or (value ~ '^/assets/[A-Za-z0-9/_ .-]+$' and position('..' in value)=0)) then raise exception 'Invalid asset URL'; end if;
 end loop;
 new.revision := case when TG_OP='INSERT' then 1 else old.revision+1 end;
 new.updated_at := now(); return new;
end $$;
drop trigger if exists herbiq_validate on public.herbiq_plants;
create trigger herbiq_validate before insert or update on public.herbiq_plants for each row execute function herbiq_private.validate_plant();
alter table public.herbiq_plants enable row level security;
revoke all on public.herbiq_plants from public, anon, authenticated;
grant select on public.herbiq_plants to anon;
grant select, insert, update, delete on public.herbiq_plants to authenticated;
drop policy if exists herbiq_read on public.herbiq_plants;
create policy herbiq_read on public.herbiq_plants for select to anon, authenticated using (published or (select public.herbiq_is_admin()));
drop policy if exists herbiq_insert on public.herbiq_plants;
create policy herbiq_insert on public.herbiq_plants for insert to authenticated with check ((select public.herbiq_is_admin()));
drop policy if exists herbiq_update on public.herbiq_plants;
create policy herbiq_update on public.herbiq_plants for update to authenticated using ((select public.herbiq_is_admin())) with check ((select public.herbiq_is_admin()));
drop policy if exists herbiq_delete on public.herbiq_plants;
create policy herbiq_delete on public.herbiq_plants for delete to authenticated using ((select public.herbiq_is_admin()));
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
 values ('herbiq-images','herbiq-images',true,5242880,array['image/jpeg','image/png','image/webp'])
 on conflict (id) do update set public=true,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','image/webp'];
drop policy if exists herbiq_photo_insert on storage.objects;
create policy herbiq_photo_insert on storage.objects for insert to authenticated with check (bucket_id='herbiq-images' and (select public.herbiq_is_admin()));
drop policy if exists herbiq_photo_select on storage.objects;
create policy herbiq_photo_select on storage.objects for select to authenticated using (bucket_id='herbiq-images' and (select public.herbiq_is_admin()));
drop policy if exists herbiq_photo_delete on storage.objects;
create policy herbiq_photo_delete on storage.objects for delete to authenticated using (bucket_id='herbiq-images' and (select public.herbiq_is_admin()));
commit;
