import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';

test('database permissions: guests/nonadmins denied writes; only admins manage plants/photos',async()=>{
 const db=new PGlite();
 try {
 await db.exec(`create role anon; create role authenticated;
 create schema auth; create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id text primary key,bucket_id text,name text);
 alter table storage.objects enable row level security;
 grant usage on schema storage to anon,authenticated;
 grant select,insert,update,delete on storage.objects to anon,authenticated;
 insert into auth.users values ('11111111-1111-1111-1111-111111111111'),('22222222-2222-2222-2222-222222222222');`);
 await db.exec(readFileSync('supabase/001_schema.sql','utf8'));
 await db.exec(readFileSync('supabase/002_seed.sql','utf8'));
 await db.exec(`insert into herbiq_private.admins values ('11111111-1111-1111-1111-111111111111'); update public.herbiq_plants set published=false where id='neem'; set role anon;`);
 assert.equal((await db.query('select * from public.herbiq_plants')).rows.length,26);
 assert.equal((await db.query("select * from public.herbiq_plants where id='neem'")).rows.length,0);
 await assert.rejects(db.exec("delete from public.herbiq_plants where id='tulsi'"));
 await assert.rejects(db.exec("insert into storage.objects values ('guest','herbiq-images','plants/guest.jpg')"));
 await db.exec(`reset role; select set_config('request.jwt.claim.sub','22222222-2222-2222-2222-222222222222',false); set role authenticated;`);
 assert.equal((await db.query<{yes:boolean}>('select public.herbiq_is_admin() as yes')).rows[0].yes,false);
 assert.equal((await db.query("update public.herbiq_plants set published=false where id='tulsi' returning id")).rows.length,0);
 assert.equal((await db.query("delete from public.herbiq_plants where id='tulsi' returning id")).rows.length,0);
 await assert.rejects(db.exec("insert into herbiq_private.admins values ('22222222-2222-2222-2222-222222222222')"));
 await assert.rejects(db.exec("insert into storage.objects values ('nonadmin','herbiq-images','plants/unauthorized.jpg')"));
 const seed=JSON.parse(readFileSync('src/data/herbiq-plants.json','utf8'))[0];
 const extra={...seed,id:'test-plant',herbiqId:'HERBIQ:test-plant'};
 await assert.rejects(db.query('insert into public.herbiq_plants(id,qr_id,profile) values ($1,$2,$3)',[extra.id,extra.herbiqId,JSON.stringify(extra)]));
 await db.exec(`reset role; select set_config('request.jwt.claim.sub','11111111-1111-1111-1111-111111111111',false); set role authenticated;`);
 assert.equal((await db.query<{yes:boolean}>('select public.herbiq_is_admin() as yes')).rows[0].yes,true);
 assert.equal((await db.query('select * from public.herbiq_plants')).rows.length,27);
 await db.query('insert into public.herbiq_plants(id,qr_id,profile) values ($1,$2,$3)',[extra.id,extra.herbiqId,JSON.stringify(extra)]);
 assert.equal((await db.query<{revision:number}>("update public.herbiq_plants set published=true where id='test-plant' and revision=1 returning revision")).rows[0].revision,2);
 assert.equal((await db.query("update public.herbiq_plants set published=false where id='test-plant' and revision=1 returning id")).rows.length,0);
 await assert.rejects(db.query('update public.herbiq_plants set profile=$1 where id=$2',[JSON.stringify({...extra,name:''}),extra.id]));
 await db.exec("insert into storage.objects values ('admin','herbiq-images','plants/admin.jpg')");
 await assert.rejects(db.exec("insert into storage.objects values ('wrong-bucket','other','private.jpg')"));
 assert.equal((await db.query("delete from storage.objects where id='admin' returning id")).rows.length,1);
 assert.equal((await db.query("delete from public.herbiq_plants where id='test-plant' returning id")).rows.length,1);
 } finally {await db.close();}
});
