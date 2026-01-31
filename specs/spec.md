# The Kyburz Table

A modern, beautiful recipe website built with markdown files, featuring Catppuccin colors and a rounded, soft design aesthetic.

---

## Design Philosophy

**"Soft Kitchen"** – A warm, inviting design that makes recipes feel approachable.

- Large rounded corners (16-24px border-radius)
- Soft shadows with subtle color tints
- Card-based layout for recipe grid
- Generous whitespace
- Clean typography (Inter or Plus Jakarta Sans)
- Mobile-first responsive design

---

## Color Palette

Using **Catppuccin** theme with both Mocha (dark) and Latte (light) variants.
Dark theme is the default, with a toggle to switch.

### Mocha (Dark Theme - Default)

| Role           | Color      | Hex       |
|----------------|------------|-----------|
| Background     | Base       | `#1e1e2e` |
| Cards/Surface  | Surface 0  | `#313244` |
| Text           | Text       | `#cdd6f4` |
| Subtext        | Subtext 1  | `#bac2de` |
| Accent (warm)  | Peach      | `#fab387` |
| Accent (cool)  | Mauve      | `#cba6f7` |
| Success/Tags   | Green      | `#a6e3a1` |
| Links          | Sapphire   | `#74c7ec` |
| Error          | Red        | `#f38ba8` |

### Latte (Light Theme)

| Role           | Color      | Hex       |
|----------------|------------|-----------|
| Background     | Base       | `#eff1f5` |
| Cards/Surface  | Surface 0  | `#ccd0da` |
| Text           | Text       | `#4c4f69` |
| Subtext        | Subtext 1  | `#5c5f77` |
| Accent (warm)  | Peach      | `#fe640b` |
| Accent (cool)  | Mauve      | `#8839ef` |
| Success/Tags   | Green      | `#40a02b` |
| Links          | Sapphire   | `#209fb5` |
| Error          | Red        | `#d20f39` |

Full palette reference: https://catppuccin.com/palette/

---

## Tech Stack

| Component        | Technology                     |
|------------------|--------------------------------|
| Framework        | Astro (with SSR for API routes)|
| Styling          | Tailwind CSS                   |
| Content          | Markdown + YAML frontmatter    |
| Database         | PostgreSQL or SQLite           |
| Automation       | n8n                            |
| Deployment       | Dokploy                        |
| Image Hosting    | Dokploy volume                 |

### Developer Tooling

| Tool             | Purpose                        |
|------------------|--------------------------------|
| just             | Command runner (justfile)      |
| ESLint           | Linting TypeScript/Astro       |
| Prettier         | Code formatting                |
| Husky            | Git hooks                      |
| lint-staged      | Run linters on staged files    |

**Pre-commit hook:** Automatically runs ESLint + Prettier on staged files before each commit.

---

## Pages

### Home Page
- Hero section with search bar
- Category/tag filter pills
- Recipe card grid (masonry or uniform)
- Cards show: image, title, time, key tags

### Recipe Page
- Large hero image
- Title, author, timing badges (prep + cook)
- Tags as colored pills
- Source attribution (name + link)
- Two-column layout on desktop:
  - Left: Ingredients (with checkboxes)
  - Right: Steps (numbered)
- Single column on mobile (image → ingredients → steps)
- Tips/notes section at bottom
- Comments and ratings section

### Category/Tag Pages
- Filtered recipe grid
- Tag description (optional)

### Submit Recipe Page
- Form for friends/family to submit recipes
- Triggers n8n workflow → GitHub PR

---

## Recipe Markdown Structure

```yaml
---
title: "Lemon Pasta"
image: "lemon-pasta.jpg"
author: "Simon"

# Timing (in minutes)
prep_time: 10
cook_time: 15

# Serving
servings: 4

# Organization
tags: [pasta, quick, vegetarian, summer]

# Source attribution (optional)
source:
  name: "Serious Eats"
  url: "https://seriouseats.com/lemon-pasta"

# Tips shown at bottom (optional)
notes: |
  Works great with any short pasta too.
  Add chili flakes for a kick.
---

## Ingredients

- `400g` spaghetti
- `2` lemons, zested and juiced
- `100g` parmesan, grated
- `4 tbsp` olive oil
- Salt and pepper to taste

## For the Garnish

- Fresh basil
- Extra parmesan

## Steps

1. Bring a large pot of salted water to boil. Cook pasta according to package.

2. While pasta cooks, zest both lemons and juice one of them.

3. Reserve 1 cup pasta water, then drain pasta.

4. Toss hot pasta with olive oil, lemon zest, juice, and parmesan. Add pasta water as needed.

5. Season with salt and pepper. Serve immediately.
```

### Structure Notes

- **Subsections**: Use `## Heading` for ingredient groups (e.g., "For the Dough", "For the Filling")
- **Amounts**: Wrap in backticks (e.g., `` `400g` ``) for parsing by the servings scaler
- **Units**: Metric only
- **Times**: Split into prep_time and cook_time (integers, in minutes)

---

## Features

### Core

| Feature              | Description                                      |
|----------------------|--------------------------------------------------|
| Markdown recipes     | Easy to write, version controlled                |
| Dark/light toggle    | Catppuccin Mocha/Latte, dark default             |
| Mobile-first         | Responsive design, works on all devices          |
| Tags                 | Fixed list, filterable (see Tag List below)      |
| Source attribution   | Credit original recipes with name + URL          |
| Search               | Client-side filtering across recipes             |

### Practical Cooking Features

| Feature              | Description                                      |
|----------------------|--------------------------------------------------|
| Ingredient checklist | Interactive checkboxes, persisted in localStorage|
| Servings scaler      | Adjust servings, ingredients recalculate         |
| Cook mode            | Larger text, screen stays awake (Wake Lock API), step-by-step |
| Shopping list        | Select multiple recipes, generate combined list, share via Web Share API or copy to clipboard |
| Favorites            | Heart icon, saved to localStorage                |
| Print stylesheet     | Clean print layout for recipes (hides nav, comments) |
| PWA / Offline        | Installable app with offline recipe access       |

### Social Features

| Feature   | Description                                           | Storage     |
|-----------|-------------------------------------------------------|-------------|
| Comments  | Name + text, no authentication required               | Database    |
| Ratings   | Name + 1-5 stars, shows average                       | Database    |

**Anti-spam measures:**
- Honeypot field (hidden field that bots fill)
- Simple math CAPTCHA ("What's 2 + 3?")
- Rate limiting

### Shopping List Implementation

- Stored in **localStorage** (per-device)
- Users can add recipes to their shopping list from recipe pages
- Combined ingredient list with deduplication (e.g., "2 lemons" + "1 lemon" = "3 lemons")
- **Share options:**
  - Web Share API (mobile): Opens native share sheet for Bring!, Notes, Messages, etc.
  - Copy to clipboard (desktop/fallback): Formatted one ingredient per line for easy pasting

### Cook Mode Implementation

- Larger text size for readability
- Step-by-step navigation (previous/next buttons)
- **Wake Lock API** keeps screen awake while cooking
  - Supported: Chrome, Edge, Safari 16.4+
  - Not supported: Firefox (graceful fallback, no error)
  - Requires HTTPS

### PWA / Offline Implementation

- **Service Worker** for offline access
- Cache recipes for offline viewing
- Installable on mobile home screen
- Offline indicator when not connected

### Print Stylesheet

`@media print` styles for recipe pages:
- Hide: navigation, theme toggle, comments, ratings UI, cook mode button
- Show: recipe image, title, ingredients, steps, tips, source attribution
- Clean single-column layout
- Include URL for source attribution

---

## Tag List

Tags are a **fixed list** to ensure consistency. Users select from these when submitting recipes.

### Categories

| Category | Tags |
|----------|------|
| **Cuisine** | italian, asian, mexican, mediterranean, american, french, indian, middle-eastern |
| **Meal** | breakfast, lunch, dinner, snack, dessert, appetizer |
| **Diet** | vegetarian, vegan, gluten-free, dairy-free, keto, low-carb |
| **Speed** | quick, weeknight, meal-prep, slow-cooker |
| **Style** | comfort-food, healthy, one-pot, grilling, salad, soup, stew |
| **Protein** | chicken, beef, pork, fish, seafood, tofu, eggs |
| **Baking** | bread, cookies, cakes, pies, pastry, muffins, brownies, tarts, sourdough, no-knead, yeast-baking, quick-bread |
| **Season** | summer, fall, winter, spring, holiday |

---

## Database Schema

```sql
-- Comments
CREATE TABLE comments (
  id          SERIAL PRIMARY KEY,
  recipe_slug VARCHAR(255) NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  content     TEXT NOT NULL,
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_comments_recipe ON comments(recipe_slug);

-- Ratings
CREATE TABLE ratings (
  id          SERIAL PRIMARY KEY,
  recipe_slug VARCHAR(255) NOT NULL,
  author_name VARCHAR(100) NOT NULL,
  rating      INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ratings_recipe ON ratings(recipe_slug);
```

---

## API Routes (Astro SSR)

| Endpoint                     | Method | Description                    |
|------------------------------|--------|--------------------------------|
| `/api/comments/[slug]`       | GET    | Get comments for a recipe      |
| `/api/comments`              | POST   | Add a comment                  |
| `/api/ratings/[slug]`        | GET    | Get ratings for a recipe       |
| `/api/ratings`               | POST   | Add a rating                   |

---

## Recipe Submission Workflow

**Goal:** Allow friends & family (non-technical) to submit recipes easily.

### Flow

```
User fills form     n8n receives      n8n creates       You review
on /submit      →   webhook POST  →   GitHub PR     →   and merge
                         │
                         ▼
                   Upload image
                   to storage
                         │
                         ▼
                   Notify you
                   (email/Slack)
```

### n8n Workflow Steps

1. Webhook receives form data + image file
2. Upload image to storage (R2/Cloudinary), get URL
3. Generate markdown content from form fields
4. Create new branch: `recipe/{slug}-{timestamp}`
5. Commit markdown file to branch
6. Create pull request
7. Send notification (email/Slack/Telegram)

### Submit Form Fields

| Field        | Type          | Required |
|--------------|---------------|----------|
| Your name    | Text          | Yes      |
| Recipe title | Text          | Yes      |
| Photo        | File upload   | Yes      |
| Prep time    | Number (min)  | Yes      |
| Cook time    | Number (min)  | Yes      |
| Servings     | Number        | Yes      |
| Tags         | Multi-select  | No       |
| Source name  | Text          | No       |
| Source URL   | URL           | No       |
| Ingredients  | Dynamic list  | Yes      |
| Steps        | Dynamic list  | Yes      |
| Tips/notes   | Textarea      | No       |

---

## Wireframes

### Home Page

```
┌─────────────────────────────────────────────────────────┐
│  The Kyburz Table               [Search...]    [🌙/☀️]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │ All     │ │ Pasta   │ │ Soups   │ │ Dessert │  ...  │
│  └─────────┘ └─────────┘ └─────────┘ └─────────┘       │
│                                                         │
│  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐ │
│  │ ░░░░░░░░░░░░░ │  │ ░░░░░░░░░░░░░ │  │ ░░░░░░░░░░░ │ │
│  │ ░░ IMAGE ░░░░ │  │ ░░ IMAGE ░░░░ │  │ ░░ IMAGE ░░ │ │
│  │ ░░░░░░░░░░░░░ │  │ ░░░░░░░░░░░░░ │  │ ░░░░░░░░░░░ │ │
│  ├───────────────┤  ├───────────────┤  ├─────────────┤ │
│  │ Lemon Pasta   │  │ Tomato Soup   │  │ Brownies    │ │
│  │ 🕐 25min  🌿  │  │ 🕐 40min      │  │ 🕐 45min    │ │
│  │ ⭐ 4.5 (12)   │  │ ⭐ 4.8 (8)    │  │ ⭐ 5.0 (3)  │ │
│  └───────────────┘  └───────────────┘  └─────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Recipe Page (Desktop)

```
┌─────────────────────────────────────────────────────────┐
│  ← Back                               [♡]      [🌙/☀️]  │
├─────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────┐   │
│  │                                                 │   │
│  │              LARGE HERO IMAGE                   │   │
│  │                                                 │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Lemon Pasta                              ⭐ 4.5 (12)   │
│  by Simon                                              │
│  ─────────────────────────────────────────────────     │
│  [🕐 25 min]  [🍽 4 servings]  [🌿 vegetarian]          │
│                                                         │
│  Source: Serious Eats ↗                                │
│                                                         │
│  ┌──────────────────┐  ┌────────────────────────────┐  │
│  │ Ingredients      │  │ Steps                      │  │
│  │ Servings: [4 ▼]  │  │                            │  │
│  │                  │  │ 1. Bring a large pot of    │  │
│  │ ☐ 400g spaghetti │  │    salted water to boil... │  │
│  │ ☐ 2 lemons       │  │                            │  │
│  │ ☐ 100g parmesan  │  │ 2. While pasta cooks...    │  │
│  │ ☐ 4 tbsp oil     │  │                            │  │
│  │                  │  │ 3. Reserve 1 cup pasta...  │  │
│  │ For the Garnish  │  │                            │  │
│  │ ☐ Fresh basil    │  │ 4. Toss hot pasta with...  │  │
│  │ ☐ Extra parmesan │  │                            │  │
│  └──────────────────┘  └────────────────────────────┘  │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │ 💡 Tips                                         │   │
│  │ Works great with any short pasta too.           │   │
│  │ Add chili flakes for a kick.                    │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ─────────────────────────────────────────────────     │
│  Rate this recipe: ☆ ☆ ☆ ☆ ☆  Your name: [_______]    │
│  ─────────────────────────────────────────────────     │
│                                                         │
│  Comments (3)                                          │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Mom · 2 days ago                                │   │
│  │ Made this last night, everyone loved it!        │   │
│  └─────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────┐   │
│  │ Add a comment                                   │   │
│  │ Name: [________]                                │   │
│  │ [____________________________________] [Post]   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Recipe Page (Mobile)

```
┌─────────────────────┐
│ ←    Lemon Pasta  ♡ │
├─────────────────────┤
│ ┌─────────────────┐ │
│ │                 │ │
│ │     IMAGE       │ │
│ │                 │ │
│ └─────────────────┘ │
│                     │
│ Lemon Pasta         │
│ by Simon            │
│ ⭐ 4.5 (12)         │
│                     │
│ [25 min] [4 serv]   │
│ [vegetarian]        │
│                     │
│ ───────────────     │
│ Ingredients    [-+] │
│ ───────────────     │
│ ☐ 400g spaghetti    │
│ ☐ 2 lemons          │
│ ☐ 100g parmesan     │
│ ...                 │
│                     │
│ ───────────────     │
│ Steps               │
│ ───────────────     │
│ 1. Bring a large    │
│    pot of salted... │
│                     │
│ 2. While pasta...   │
│                     │
│ ───────────────     │
│ 💡 Tips             │
│ ───────────────     │
│ Works great with... │
│                     │
│ [🍳 Cook Mode]      │
│                     │
│ ───────────────     │
│ Comments (3)        │
│ ───────────────     │
│ ...                 │
└─────────────────────┘
```

### Submit Recipe Page

```
┌─────────────────────────────────────────────────────────┐
│  📝 Submit a Recipe                            [🌙/☀️]  │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Your name *                                            │
│  [________________________]                             │
│                                                         │
│  Recipe title *                                         │
│  [________________________]                             │
│                                                         │
│  Photo *                                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │  📷 Drop image here or click to upload          │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  Timing                                                 │
│  Prep: [____] min     Cook: [____] min                 │
│                                                         │
│  Servings: [____]                                       │
│                                                         │
│  Tags                                                   │
│  [pasta ×] [quick ×] [+ add tag]                       │
│                                                         │
│  Where's this recipe from? (optional)                   │
│  Name: [________________]  URL: [________________]      │
│                                                         │
│  ─────────────────────────────────────────────────     │
│  Ingredients *                                          │
│  ┌────────────┬────────────────────────────┬───┐       │
│  │ Amount     │ Ingredient                 │ × │       │
│  ├────────────┼────────────────────────────┼───┤       │
│  │ 400g       │ spaghetti                  │ × │       │
│  │ 2          │ lemons, zested and juiced  │ × │       │
│  │            │                            │   │       │
│  └────────────┴────────────────────────────┴───┘       │
│  [+ Add ingredient]                                     │
│                                                         │
│  ─────────────────────────────────────────────────     │
│  Steps *                                                │
│  ┌─────────────────────────────────────────────┬───┐   │
│  │ 1. Boil pasta in salted water               │ × │   │
│  ├─────────────────────────────────────────────┼───┤   │
│  │ 2. Zest and juice the lemons                │ × │   │
│  ├─────────────────────────────────────────────┼───┤   │
│  │ 3.                                          │   │   │
│  └─────────────────────────────────────────────┴───┘   │
│  [+ Add step]                                           │
│                                                         │
│  ─────────────────────────────────────────────────     │
│  Tips / Notes (optional)                                │
│  [_________________________________________________]   │
│  [_________________________________________________]   │
│                                                         │
│  ─────────────────────────────────────────────────     │
│  🧮 Quick check: What's 3 + 4? [____]                  │
│                                                         │
│              [Preview]     [Submit Recipe]              │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Image Storage

Images are stored in a Dokploy volume, shared between Astro and n8n.

### Volume Structure

```
/images/
├── recipes/
│   ├── lemon-pasta.jpg          # original
│   ├── lemon-pasta-thumb.webp   # thumbnail (400px, WebP)
│   ├── tomato-soup.jpg
│   ├── tomato-soup-thumb.webp
│   └── ...
└── uploads/                      # temporary upload staging (optional)
```

### Image Optimization Strategy (Hybrid)

**On upload (n8n):**
- n8n uses sharp to create a thumbnail (400px wide, WebP format)
- Saves both original and thumbnail to volume

**At build time (Astro):**
- Astro's `<Image>` component optimizes hero images
- Generates responsive srcsets for different screen sizes

This gives fast card thumbnails without rebuild delays, while Astro optimizes larger images.

### Upload Flow (via n8n)

1. User submits recipe form with image
2. n8n receives the image
3. n8n processes with sharp:
   - Save original: `/images/recipes/{slug}.jpg`
   - Generate thumbnail: `/images/recipes/{slug}-thumb.webp` (400px wide)
4. n8n includes image filename in markdown PR

### Serving Images

Astro serves images from the volume via static file serving or a dedicated route.

```
https://recipes.siwachter.com/images/recipes/lemon-pasta.jpg
```

### Backup Strategy

- Regular volume backups via Dokploy or cron
- Images are also committed to GitHub repo as part of PR (optional redundancy)

---

## Deployment

### Services in Dokploy

| Service       | Purpose                          |
|---------------|----------------------------------|
| Astro app     | Main website + API routes        |
| PostgreSQL    | Comments and ratings             |
| n8n           | Recipe submission automation     |
| Volume: images| Shared image storage             |

### Build & Deploy Flow

```
GitHub repo          Dokploy              Live site
     │                  │                     │
     │   push/merge     │                     │
     │ ───────────────► │ build Astro         │
     │                  │ ──────────────────► │
     │                  │                     │
```

---

## Decisions Log

| Question | Decision |
|----------|----------|
| Site name | **The Kyburz Table** |
| Image hosting | Dokploy volume (self-hosted, backed up) |
| Image optimization | Hybrid: n8n creates thumbnail on upload, Astro optimizes hero images at build |
| Search | Client-side filtering |
| Tags | Fixed list (see Tag List section) |
| Comment moderation | None (trust anti-spam measures) |
| Cook mode | Wake Lock API with graceful fallback for unsupported browsers |
| Shopping list | localStorage + Web Share API with clipboard fallback |
| Print stylesheet | Yes |
| PWA / Offline | Yes |
| Domain | recipes.siwachter.com |

---

## References

- [Catppuccin Palette](https://catppuccin.com/palette/)
- [Schema.org Recipe](https://schema.org/Recipe)
- [Google Recipe Structured Data](https://developers.google.com/search/docs/appearance/structured-data/recipe)
- [n8n GitHub Integration](https://n8n.io/integrations/github/)
- [Astro Documentation](https://docs.astro.build/)
