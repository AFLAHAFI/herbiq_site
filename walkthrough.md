# HERBIQ Implementation Walkthrough

## What Was Added
- **10-Plant Core Database**: Fully migrated the backend to `herbiq-plants-v3.json` mapping exactly 10 plants (`1.jpg` to `10.jpg`) as per the requirement.
- **HerbiQ ID System**: Added `herbiqId` to the `Plant` type to uniquely identify scanned plants.
- **QR Scanner Page**: Added `QRScannerPage.tsx` using `html5-qrcode` CDN integration which gracefully requests camera permission, scans physical QR codes (e.g. `HERBIQ:tulsi`), and instantly redirects the visitor to the corresponding plant profile.
- **Dynamic AR System**: Updated `ARExperiencePage.tsx` and `PlantDetailPage.tsx` to read the `arAvailable` property instead of hardcoding plant IDs, allowing any future plant to easily plug into the AR system simply by setting a flag in the DB.
- **Profile Layout Refactor**: Rearranged `PlantDetailPage.tsx` to match the exact field requirements including "Medicinal Benefits". Added the "Scan QR" button directly on the profile to allow users to scan their next botanical specimen.

## Verification Performed
1. Navigated to `/` -> Verified all 10 plant cards load with correct images.
2. Hit the "Scan QR" button -> Camera permission successfully prompts and opens viewfinder.
3. Searched for Tulsi -> Clicked "Ask HerbiQ" -> Passed `Tell me about Holy Basil / Tulsi and its traditional uses` to the bot, which correctly found Tulsi in the database and responded.

## How to add Plant #11 later
1. Open `src/data/herbiq-plants-v3.json`.
2. Append a new object:
```json
{
  "id": "new-plant",
  "herbiqId": "HERBIQ:new-plant",
  "name": "New Plant Name",
  "image": "/assets/plants/11.jpg",
  // ... other fields
}
```
3. The app will automatically populate the new plant in the directory, the QR scanner will immediately recognize `HERBIQ:new-plant`, and the AI will be able to answer questions about it.
