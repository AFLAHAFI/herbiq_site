# HerbiQ — Admin, QR and 3D upgrade

Start with **SETUP.md**. The complete source, database scripts, 27 plant photos and five GLB assets are included.

## Included

- Supabase email/password admin login with server-enforced allowlist and row-level security.
- Add/edit/delete, publish/hide, unique QR IDs, photo uploads and edit-conflict checks.
- Shared public catalog from Supabase; local sample catalog when no backend is configured.
- Individual/bulk QR labels, PNG downloads, A4 print / Save as PDF, ID and website-link formats.
- Five textured GLB illustrations: Tulsi, Neem, Aloe Vera, Turmeric and Ginger.
- Interactive model-viewer with compatible-device AR and normal 3D fallback.
- Existing search, profiles, QR scanner, shareable navigation and database-based guide retained.

## Commands

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
npm run preview
```

Use Node.js 22 or newer. Production output is `dist`. See SETUP.md for Vercel environment variables and Supabase setup. No account credentials or live backend connection are included; nothing has been deployed.

## Important files

- `supabase/001_schema.sql`: admin access rules, plant table, validation and photo storage policies.
- `supabase/002_seed.sql`: original 27-plant catalog.
- `src/data/herbiq-plants.json`: offline/sample seed, not the authoritative catalog after Supabase connection.
- `public/assets/plants/`: existing photos.
- `public/assets/models/`: self-contained GLBs and model disclosure.
- `scripts/build_models.py`: deterministic original geometry/texture generator (requires Python, numpy and Pillow only if rebuilding models).
- `tests/`: catalog, validation, QR decode, GLB validation and database authorization tests.

Models are detailed computer-made illustrations, not verified scans. Real AI/voice is not connected. Printing and editing require admin setup. Photos use public storage. Physical QR-camera/AR tests and real hosted authentication remain deployment acceptance steps.
