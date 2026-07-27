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

# Generate PWA icons + emote manifest, then start dev server
npm run dev
```

Open `http://localhost:4321/emotelab-query` in your browser.

## Adding New Emotes

1. Drop `.gif` files into `public/emotes/<character-name>/`
2. Run `npm run generate` to rebuild the searchable manifest
3. Optionally add tag enrichment in `scripts/generate-manifest.js` → `TAG_ENRICHMENT`

## Deployment (GitHub Pages)

### 1. Update config

Edit `astro.config.mjs` and replace `YOUR_USERNAME` with your GitHub username:

```js
site: "https://YOUR_USERNAME.github.io",
```

### 2. Push to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOUR_USERNAME/emotelab-query.git
git push -u origin main
```

### 3. Enable GitHub Pages

Go to your repo on GitHub → **Settings** → **Pages** → set **Source** to **GitHub Actions**.

The deploy workflow (`.github/workflows/deploy.yml`) will automatically build and deploy on every push to `main`.

Your site will be live at `https://YOUR_USERNAME.github.io/emotelab-query/`.

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

## License

MIT
