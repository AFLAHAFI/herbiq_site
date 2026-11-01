# Connect the upgraded HerbiQ website

The code includes secure admin management, printable QR labels and five actual GLB models. It is not connected to your Supabase account or deployed automatically. Without the two public connection settings, the visitor catalog and five models work from local files; admin login shows setup instructions.

## 1. Prepare Supabase

1. Create/open a Supabase project you control. Use a dedicated project unless you have reviewed its existing database/storage policies.
2. Open its SQL Editor. Run `supabase/001_schema.sql` first.
3. Run `supabase/002_seed.sql` to import the 27 existing plants, photos and five model references. It adds absent IDs without overwriting existing edits. Do not rerun this seed to “refresh” a catalog after intentionally deleting plants: deleted seed plants would be re-added.
4. In Authentication, create your administrator email/password user. Disable public signups if this project serves only HerbiQ admins. Creating a normal account does NOT grant admin permission.
5. Copy that user's UUID from Authentication. In SQL Editor run the following after replacing the UUID:

```sql
insert into herbiq_private.admins(user_id)
values ('YOUR-ADMIN-USER-UUID'::uuid)
on conflict do nothing;
```

There is no default admin password. Never put a password, service-role key or secret API key in this website's code. To revoke an administrator:

```sql
delete from herbiq_private.admins
where user_id = 'USER-UUID-TO-REMOVE'::uuid;
```

Password recovery can be handled through your Supabase project administration. This release does not include a visitor signup or password-reset page.

## 2. Connect locally

Copy `.env.example` to `.env.local`, then set:

```dotenv
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR-PUBLIC-PUBLISHABLE-KEY
```

Use the project URL and **publishable** key from the Supabase project settings. These identify the project publicly; database/storage access rules enforce authorization. Do not use a service-role or secret key. Restart the dev server after changing these values.

```sh
npm ci
npm run dev
```

Open the website, choose **Admin** in the footer, and sign in. The route is `/#page=admin`.

## 3. Update your existing Vercel project

Upload/push the project contents, including `src/`, `public/`, `package.json`, `package-lock.json` and the root configuration files. Do not upload `node_modules`, `.env.local` or private credentials.

Configure the same two public variables in the Vercel project's environment settings. Build with `npm run build` and serve `dist` using the Vite framework preset. Redeploy after changing environment variables. Plant/model URLs use root-relative `/assets/` paths: deploy at the domain root.

Both settings must be present. Once connected, the live database is authoritative: the site does not silently show bundled plants if the database is unreachable, empty, or a plant is hidden. The bundled JSON and seed SQL are still public source assets; they contain the original public catalog, not private data.

## 4. Manage plants

- **Add plant:** choose a stable lowercase hyphenated ID; complete profile/health fields; upload a photo; save as hidden or published.
- **Edit:** change names, descriptions, photo and QR ID. Plant IDs remain fixed to preserve page links.
- **Photos:** JPG/PNG/WebP under 10 MB are converted to JPEG up to 1600 pixels before upload. Uploading does not publish an edit; press **Save plant**. Photos are stored in a public bucket, so hiding a plant hides its profile, not a previously known photo URL. Use only public plant photos.
- **Publish/hide:** visitors see only published records. The editing browser refreshes after save; other open visitor tabs refresh on focus or within 60 seconds.
- **Delete:** confirmation is required. Previous labels will stop resolving. Uploaded photos are retained to avoid accidentally deleting an image reused by another plant; remove unused photos in Supabase Storage when appropriate.
- **Simultaneous edits:** revision checking rejects stale changes. Refresh and reopen the plant if another admin edited it.
- **Models:** existing five GLBs are included. To add another, place its `.glb` in `public/assets/models/` and redeploy, then set the model URL and enable 3D/AR. External HTTPS models must allow cross-origin loading. A model upload interface is not included.

## 5. Print QR labels

In Admin choose a plant's **QR label**, or select multiple plants and choose **Print selected**. Choose either:

- **HERBIQ ID:** encodes e.g. `HERBIQ:tulsi`. Use the HerbiQ website scanner.
- **Website link:** enter your final HTTPS website address. Ordinary phone cameras can open the plant directly. The HerbiQ scanner accepts website links for its own origin and path.

Download an individual PNG or use **Print / Save as PDF**. Choose A4, 100% scale, no browser headers/footers. Printed labels contain English/Malayalam/scientific names. Hidden plants need publishing before their labels can open public profiles. Changing a QR ID invalidates existing ID labels; stable website links still use the unchanged plant ID.

## 6. Five plant models and phone AR

Tulsi, Neem, Aloe Vera, Turmeric and Ginger have self-contained, textured GLBs. They are original computer-made educational illustrations with species-specific shapes, not photogrammetry, photoreal scans or botanically verified specimens. Keep the disclosure visible. See `public/assets/models/README.md` for asset details.

The viewer provides rotation, zoom, reset and camera placement through model-viewer's WebXR / Scene Viewer / Quick Look paths where supported. Unsupported devices retain normal 3D viewing. Physical camera permissions and actual AR tracking must be tested on your target phones after HTTPS deployment. Desktop headless tests do not verify physical AR.

## 7. Checks before sharing publicly

Run `npm test`, `npm run lint`, and `npm run build`. Then on your configured deployment verify:

1. Signed-out and non-admin users cannot save/delete plants or upload photos.
2. Admin login, upload, save, hide, publish, delete and logout work against your real Supabase project.
3. A hidden test plant is absent from a signed-out private/incognito browser, including its direct link and QR lookup.
4. A printed ID label and a website-link label scan correctly on real phones.
5. Each model loads; camera placement can start and exit on a supported phone; unsupported phones retain 3D view.

The included database test uses real PostgreSQL semantics through PGlite with local Auth/Storage schema fixtures. Browser admin tests used mocked service responses. Neither substitutes for testing the final hosted Supabase configuration.

References: [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security), [Storage access control](https://supabase.com/docs/guides/storage/security/access-control), [model-viewer AR examples](https://modelviewer.dev/examples/augmentedreality/).
