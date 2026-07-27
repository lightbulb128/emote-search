# 🎬 EmoteLab Query

A Progressive Web App for browsing, searching, and sharing anime character emotes (GIFs). Built with [Astro](https://astro.build/) and deployed to GitHub Pages — no backend needed.

## Features

- 🔍 **Fuzzy search** — search by action name, tags, or character. Supports multi-word queries with smart ranking (exact token matches appear first)
- 👤 **Character filter** — switch between characters (Alice / Shinki), selection persists across sessions
- 📤 **One-tap share** — tap any GIF to trigger the native share sheet (Web Share API), with clipboard fallback
- 📱 **PWA** — installable to your phone's home screen, works offline, appears in Android share sheet
- 📦 **Compact mode** — when search results are many, shows top 3 as GIF previews + text-only list for the rest (toggleable)
- 🌙 **Dark theme**

## Quick Start

```bash
# Install dependencies
npm install

# Drop your GIFs into public/emotes/<character>/, then:
npm run dev
```

Open `http://localhost:4321/emote-search` in your browser.

## Adding New Emotes

1. Drop `.gif` files into `public/emotes/<character-name>/`
2. Run `npm run generate` to rebuild the searchable manifest
3. Optionally add tag enrichment in `scripts/generate-manifest.js` → `TAG_ENRICHMENT`

## Deployment

### Architecture

GIFs are too large for GitHub (500MB+). They're stored on **Cloudflare R2** (10GB free tier). The site itself is a static PWA hosted on GitHub Pages.

- **Local dev**: GIFs served from `public/emotes/` (kept locally, gitignored)
- **Production**: GIFs served from R2. The build reads `PUBLIC_EMOTE_BASE_URL` env var and rewrites image URLs to R2.

### 1. Set up Cloudflare R2

1. Create an R2 bucket at [dash.cloudflare.com](https://dash.cloudflare.com) → R2
2. Create an API token with **Object Read & Write** permission
3. Enable public access for your bucket under **Settings** → **Public Access** → allow `r2.dev` subdomain
4. Note your public URL (e.g. `https://pub-xxxxxxxxxxxxxxxxxxxxx.r2.dev`)

### 2. Upload GIFs to R2

Copy `.env.example` to `.env` and fill in your R2 credentials, then:

```bash
npm run upload
```

This uploads all GIFs from `public/emotes/` to R2 with `Cache-Control: public, max-age=31536000, immutable`.

### 3. Configure GitHub

Add these secrets in your repo → **Settings** → **Secrets and variables** → **Actions**:

| Secret | Value |
|---|---|
| `PUBLIC_EMOTE_BASE_URL` | Your R2 public URL (e.g. `https://pub-xxx.r2.dev`) |

### 4. Push to GitHub

```bash
git remote add origin git@github.com:lightbulb128/emote-search.git
git push -u origin main
```

### 5. Enable GitHub Pages

Repo → **Settings** → **Pages** → Source: **GitHub Actions**.

Your site will be live at `https://lightbulb128.github.io/emote-search/`.

### Adding new characters/emotes

```bash
# 1. Drop new GIFs into public/emotes/<new-character>/
# 2. Upload to R2
npm run upload
# 3. Regenerate manifest
npm run generate
# 4. Commit & push (GIFs are gitignored, only the manifest changes)
git add src/data/ scripts/generate-manifest.js
git commit -m "Add <character> emotes"
git push
```

## Project Structure

```
emotelab-query/
├── public/
│   ├── emotes/              # ← GIF files organized by character
│   │   ├── alice/
│   │   └── shinki/
│   ├── manifest.json        # PWA manifest
│   └── sw.js                # Service worker (offline cache)
├── scripts/
│   ├── generate-manifest.js # Scans GIFs → builds searchable JSON
│   └── generate-icons.js    # SVG → PNG PWA icons
├── src/
│   ├── pages/index.astro    # Main page
│   ├── layouts/Layout.astro # Shell + PWA meta tags
│   ├── components/
│   │   ├── SearchBar.astro  # Search input + character tabs
│   │   └── EmoteGrid.astro  # GIF grid + share logic + compact mode
│   ├── lib/
│   │   ├── search.ts        # Fuse.js fuzzy search + ranking
│   │   └── types.ts
│   └── data/manifest.json   # Auto-generated emote index
├── astro.config.mjs
└── .github/workflows/deploy.yml
```

## Tech Stack

- [Astro](https://astro.build/) — static site generator
- [Fuse.js](https://fusejs.io/) — client-side fuzzy search
- [Sharp](https://sharp.pixelplumbing.com/) — PWA icon generation
- GitHub Pages + GitHub Actions — free hosting & CI/CD
