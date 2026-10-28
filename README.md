# The Mati Cafe & Restaurant

A QR-based informational menu for a vegetarian café and Indian restaurant. Guests scan a table QR code, browse the menu, and place their order with restaurant staff.

This is a static React frontend. There is no cart, checkout, payment, kitchen notification or backend.

## Quick start

```bash
npm install
npm run generate:catalogue
npm run generate:fallbacks
npm run download:fonts
npm run download:images
npm run dev
```

Open http://localhost:5173

Live site (GitHub Pages): https://sultanbytes.github.io/The-Mati-Cafe-And-Restaurant/

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview the production build |
| `npm run generate:catalogue` | Rebuild `public/data/menu.json` from `scripts/generate-catalogue.mjs` |
| `npm run generate:fallbacks` | Create illustrated category fallback images |
| `npm run download:images` | Download permitted Wikimedia photos for active dishes |
| `npm run download:fonts` | Copy OFL font files into `public/fonts/` |
| `npm run validate:menu` | Validate schema, ids, visibility and local image paths |
| `npm run check` | Automated data and logic checks |

## Routes

- `/` — public dine-in menu
- `/?table=04` — same menu, labelled for table `04` if the value is 1–8 letters, numbers or hyphens
- `/?preview=draft` — preview the **local browser draft**. Opening this URL on another device does not show that draft
- `/manage-control/tmc` — menu management utility. It is **not linked** from public navigation

Without a `table` query, the header shows **Dine-in Menu**. No default table number is invented.

## Static deployment and SPA fallback

`npm run build` writes a static site in `dist/`. Host that folder on any static host.

Because this is a single-page app, unknown paths must serve `index.html`:

- **Netlify** — `public/_redirects` and `netlify.toml` are included (`/* /index.html 200`)
- **Vercel** — `vercel.json` rewrites all routes to `index.html`
- **GitHub Pages / nginx** — add a fallback, for example:

```nginx
location / {
  try_files $uri $uri/ /index.html;
}
```

Apache equivalent:

```
FallbackResource /index.html
```

Direct refresh of `/manage-control/tmc` only works after that fallback is configured.

## Menu data

Published source of truth:

- `public/data/menu.json`
- `public/data/image-sources.json`
- `public/images/menu/`
- `public/images/fallbacks/`

Schema version `1`:

```json
{
  "schemaVersion": 1,
  "revision": "initial",
  "restaurant": {
    "name": "The Mati Cafe & Restaurant",
    "currency": "INR",
    "description": "",
    "address": "",
    "phone": "",
    "openingHours": "",
    "footerText": "",
    "wifi": { "enabled": false, "name": "", "password": "" }
  },
  "categories": [{ "id": "tea", "name": "Tea", "description": "", "isActive": true, "sortOrder": 1 }],
  "items": [{
    "id": "tea",
    "categoryId": "tea",
    "name": "Tea",
    "nameHi": "चाय",
    "description": "Regular milk tea, cafe style.",
    "price": 25,
    "image": "/images/menu/tea.webp",
    "tags": ["tea"],
    "spiceLevel": "",
    "isActive": true,
    "isFeatured": false,
    "sortOrder": 1,
    "variants": [{ "id": "tea-regular", "name": "Regular", "price": 25 }]
  }]
}
```

An item is publicly visible only when `item.isActive === true` **and** its category `isActive === true`. Search, featured dishes, counts, navigation and details all use that rule.

Empty optional restaurant fields (address, phone, hours, Wi-Fi) stay hidden on the public page.

Imported JSON is never rendered as HTML.

## Admin draft behaviour

`/manage-control/tmc` is a **local editing utility**, not secure authentication. A hidden route is not a login.

Frontend-only admin edits are drafts on **this browser**:

1. **Save draft** — versioned `localStorage`
2. **Preview draft** — opens `/?preview=draft` on this device
3. **Export menu.json** — UTF-8 JSON download
4. **Import menu.json** — validated before it replaces the current draft
5. **Export publication package** — ZIP with `data/menu.json` and referenced `images/`
6. **Discard draft** — reload published `menu.json`

Admin image uploads are written into `public/images/menu/` with a unique `{name}-{YYYYMMDD-HHmmss}.webp` filename. Saving an item also writes that path into `public/data/menu.json`, so the photo stays after refresh until an admin changes or removes it. Blob URLs and machine-specific paths are never exported.

If storage is full or unavailable, the in-memory draft remains editable and export still works. The UI will not claim the draft was saved.

Updating the **shared public menu** requires exporting files, replacing or merging them into `public/`, rebuilding, and redeploying. localStorage is not shared with other devices or visitors.

### Publish workflow

1. Edit in `/manage-control/tmc`
2. Save draft and preview on this browser
3. Export the publication ZIP (or `menu.json` plus images)
4. Replace or merge into the project `public/` directory:
   - `public/data/menu.json`
   - `public/images/menu/`
   - `public/data/image-sources.json` if attribution changed
5. Run `npm run validate:menu`
6. Run `npm run build`
7. Deploy `dist/`

## Activating catalogue items

The JSON file is an owner-selectable **master catalogue**, not a claim that every dish is currently served.

**Catalogue prices and availability are initial suggestions and require owner review before launch.**

To put a dish on the public menu:

1. Open `/manage-control/tmc`
2. Find the item, mark it **Active**
3. Confirm its category is active
4. Save draft, export, replace `public/` files, rebuild and redeploy

## Images and licences

Dish-specific photos were downloaded only where a relevant, permitted Wikimedia Commons file could be verified (CC BY, CC BY-SA, CC0 / public domain). Unrelated search hits were discarded.

Current coverage (honest, not 550 unique photos):

- 20 unique licensed dish photos
- 2 items share an accurate iced-coffee photo for cold-coffee variations
- Remaining catalogue items use illustrated category fallbacks in `public/images/fallbacks/`

Re-run `npm run download:images` during development to resume. The script uses timeouts, retries, 429 backoff, file-type checks and `scripts/.image-cache.json`.

`public/data/image-sources.json` records local filename, source page, asset URL, creator, licence, attribution and modifications.

The public footer shows an image-credits control when attribution is required.

Do not hotlink remote images at runtime. Do not commit API keys.

Re-run `npm run download:images` during development if you need to resume downloads. The script uses limited concurrency, timeouts, retries, file-type checks and `scripts/.image-cache.json`.

## Fonts

Playfair Display and DM Sans are SIL Open Font License fonts, bundled from `@fontsource` into the Vite build and copied to `public/fonts/`. Fallbacks are Georgia / Times New Roman and system UI sans-serif.

## What this project does not do

No cart, order tray, add-to-cart, checkout, payments, waiter call, water request, kitchen status, or invented service charges.
