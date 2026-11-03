-- Migration 004: Enable 3D GLB model uploads in Supabase Storage bucket herbiq-images
-- Run in Supabase Dashboard -> SQL Editor

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'herbiq-images',
  'herbiq-images',
  true,
  26214400, -- 25 MB limit to accommodate textured .glb 3D models and high-res photos
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'model/gltf-binary',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = true,
  file_size_limit = 26214400,
  allowed_mime_types = array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'model/gltf-binary',
    'application/octet-stream'
  ];

commit;
