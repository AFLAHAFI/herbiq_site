# Verification of this upgrade

## Passed

- Production Vite build and TypeScript check.
- Seven automated test groups (`npm test`): all 27 records/images/QR IDs; search; full plant questions; unsafe/incomplete field rejection; all 27 QR PNGs decoded back to exact IDs; five GLB models validated; database authorization checks.
- PostgreSQL policy execution through PGlite, with fixture Auth/Storage schemas: anonymous/non-admin users cannot mutate plants or upload photos; hidden plants are not visible publicly; admin CRUD and photo access work; unauthorized admin self-enrollment is denied; stale revisions do not overwrite edits.
- Chromium visitor checks: Malayalam search, profile reload, question links, manual QR input, all five model files load and render, setup state, and responsive bounds at 360/800/1280 pixels. No uncaught page errors.
- Chromium admin interaction checks with mocked Supabase HTTP responses: login, photo upload, edit, hide, add, delete, QR preview, print stylesheet and logout. No uncaught page errors.
- Malayalam font bundled locally, including QR label font loading before printing.

## Not verified against a live account/device

- Supabase project provisioning, hosted authentication, actual hosted storage transfers and its complete existing policy environment. A project/account connection was not available; use SETUP.md.
- Camera permissions and scanning actual paper labels on physical phones.
- Physical WebXR / Android Scene Viewer / iOS Quick Look placement, tracking, and camera-session exit.
- Botanical accuracy or photorealism: assets are original computer-made 3D illustrations, not scans or verified specimens.

The 3D engine remains a large on-demand chunk; it does not load on the initial home page. Camera/AR work requires HTTPS or localhost and compatible device support. No live website deployment occurred.
