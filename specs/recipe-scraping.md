# Recipe URL Scraping

Add the ability to import recipes from external URLs on the `/submit` page. Scraped data pre-fills the form, allowing users to review and edit before submission.

---

## Architecture

```
User pastes URL     Astro API fetches     Parse JSON-LD        Pre-fill form
   (/submit)    →   page HTML         →   or HTML fallback  →  for review
                    (/api/scrape)                                    │
                                                                     ▼
                                                              User submits
                                                                     │
                                                                     ▼
                                                              n8n creates PR
                                                              (existing flow)
```

**Key insight**: Scraping is separate from PR creation. The scraper pre-fills the form; the existing n8n workflow handles PR creation after user review.

---

## Data Types

### ScrapedRecipe

```typescript
interface ScrapedRecipe {
  title: string;
  description?: string;
  prepTime?: number;        // minutes
  cookTime?: number;        // minutes
  servings?: number;
  ingredients: Array<{ amount: string; name: string }>;
  steps: string[];
  imageUrl?: string;        // External URL (will be downloaded)
  imagePath?: string;       // Local path after download
  thumbnailPath?: string;   // Local thumbnail path
  sourceName?: string;      // Site name (e.g., "Serious Eats")
  sourceUrl: string;        // Original URL
}
```

This maps directly to the existing `SubmissionData` type in `submit.ts`, minus author info.

---

## Components

### 1. Scraper Library (`src/lib/scraper.ts`)

Core parsing logic with two extraction strategies:

#### Primary: JSON-LD Extraction

Most recipe sites include Schema.org structured data for SEO:

```html
<script type="application/ld+json">
{
  "@type": "Recipe",
  "name": "Lemon Pasta",
  "recipeIngredient": ["400g spaghetti", "2 lemons"],
  "recipeInstructions": [...]
}
</script>
```

**Functions**:
- `extractJsonLd(html: string): Recipe | null`
- Handle both single Recipe and `@graph` arrays
- Parse ISO 8601 durations (`PT30M` → 30 minutes)

#### Fallback: HTML Parsing

For sites without structured data, use common CSS selectors:

```typescript
const SELECTORS = {
  title: ['h1.recipe-title', '.recipe-header h1', 'h1'],
  ingredients: ['.ingredients li', '.recipe-ingredients li'],
  instructions: ['.instructions li', '.recipe-steps li'],
  // ... etc
};
```

#### Ingredient Parsing

Split ingredient strings into amount and name, with aggressive metric conversion:

```typescript
interface ParsedIngredient {
  original: string;                    // "1 cup all-purpose flour, sifted"
  amount: string;                      // "120g"
  name: string;                        // "all-purpose flour, sifted"
  converted: boolean;                  // true if unit was converted
  confidence: 'high' | 'medium' | 'low';  // conversion confidence
}

function parseIngredient(text: string): ParsedIngredient
```

**Parsing strategy (aggressive)**:

1. **Word numbers** → digits: "One" → "1", "Two" → "2"
2. **Fractions** → decimals: "½" → "0.5", "1/2" → "0.5"
3. **Weight conversion**: `oz` → `g` (×28), `lb` → `g` (×454)
4. **Volume conversion** (with defaults):
   - `cup` → `ml` (×240) or `g` for common ingredients
   - `tbsp` → `ml` (×15)
   - `tsp` → `ml` (×5)
   - `fl oz` → `ml` (×30)
5. **Abbreviation normalization**: "tablespoon" → "tbsp", "teaspoon" → "tsp"

**Ingredient-aware volume→weight conversion**:

```typescript
const DENSITY_MAP: Record<string, number> = {
  'flour': 120,      // 1 cup = 120g
  'sugar': 200,      // 1 cup = 200g
  'brown sugar': 220,
  'butter': 227,     // 1 cup = 227g
  'milk': 245,       // 1 cup = 245g (≈ml)
  'water': 240,
  'oil': 218,
  'honey': 340,
  'rice': 185,
  'oats': 90,
  // ... etc
};
```

**Confidence levels**:
- `high`: Direct unit conversion (oz→g) or known ingredient density
- `medium`: Used default density or common assumption
- `low`: Couldn't parse properly, kept original

**Edge cases**:
- No amount: "Salt and pepper to taste" → `{ amount: "", name: "Salt and pepper to taste", converted: false }`
- Ranges: "1-2 tbsp olive oil" → `{ amount: "15-30ml", name: "olive oil", converted: true }`
- Mixed units: "1 lb 4 oz beef" → `{ amount: "567g", name: "beef", converted: true }`

---

### 2. API Endpoint (`src/pages/api/scrape.ts`)

#### Route

```
GET /api/scrape?url=<encoded-url>
```

#### Request Flow

1. **Validate URL** - Must be valid HTTP/HTTPS URL
2. **Rate limit** - Reuse existing `rateLimit.ts` (10 req/min)
3. **Fetch HTML** - With appropriate User-Agent header
4. **Extract recipe** - JSON-LD first, then HTML fallback
5. **Download image** - If `imageUrl` present, download and process with sharp
6. **Return JSON** - `ScrapedRecipe` object

#### Response Codes

| Code | Meaning |
|------|---------|
| 200 | Success, recipe found |
| 400 | Invalid URL format |
| 404 | No recipe found on page |
| 429 | Rate limited |
| 502 | Failed to fetch URL |

#### Example Response

```json
{
  "title": "Lemon Pasta",
  "description": "A bright, citrusy pasta dish...",
  "prepTime": 10,
  "cookTime": 15,
  "servings": 4,
  "ingredients": [
    { "amount": "400g", "name": "spaghetti" },
    { "amount": "2", "name": "lemons, zested and juiced" }
  ],
  "steps": [
    "Bring a large pot of salted water to boil...",
    "While pasta cooks, zest both lemons..."
  ],
  "imagePath": "/images/submissions/scrape-1234567890.webp",
  "thumbnailPath": "/images/submissions/scrape-1234567890-thumb.webp",
  "sourceName": "Serious Eats",
  "sourceUrl": "https://seriouseats.com/lemon-pasta"
}
```

---

### 3. Submit Page Changes (`src/pages/submit.astro`)

#### New UI Section

Add import section at the top of the form, before "Basic Information":

```
┌─────────────────────────────────────────────────────────────────┐
│  Import from URL                                                │
│                                                                 │
│  ┌─────────────────────────────────────────────┐  ┌──────────┐ │
│  │ https://example.com/recipe                  │  │  Import  │ │
│  └─────────────────────────────────────────────┘  └──────────┘ │
│                                                                 │
│  ────────────────── or enter manually ──────────────────        │
└─────────────────────────────────────────────────────────────────┘
```

#### JavaScript Additions

```typescript
// Handle import button click
async function handleImport() {
  const url = importUrlInput.value.trim();
  if (!url) return;

  setImportLoading(true);
  try {
    const response = await fetch(`/api/scrape?url=${encodeURIComponent(url)}`);
    const data = await response.json();

    if (!response.ok) {
      showMessage(data.error || 'Failed to import recipe', 'error');
      return;
    }

    populateForm(data);
    showMessage('Recipe imported! Please review and edit as needed.', 'success');
  } catch (error) {
    showMessage('Network error while importing', 'error');
  } finally {
    setImportLoading(false);
  }
}

// Populate form fields with scraped data
function populateForm(data: ScrapedRecipe) {
  // Basic fields
  setFieldValue('title', data.title);
  setFieldValue('description', data.description);
  setFieldValue('prep_time', data.prepTime);
  setFieldValue('cook_time', data.cookTime);
  setFieldValue('servings', data.servings);
  setFieldValue('source_name', data.sourceName);
  setFieldValue('source_url', data.sourceUrl);
  setFieldValue('notes', '');

  // Clear and populate ingredients
  clearIngredients();
  data.ingredients.forEach(ing => addIngredient(ing.amount, ing.name));

  // Clear and populate steps
  clearSteps();
  data.steps.forEach(step => addStep(step));

  // Set image preview if available
  if (data.imagePath) {
    setImagePreview(data.imagePath);
  }
}
```

#### Loading States

- Import button shows spinner during fetch
- Disable form fields during import
- Show progress message: "Importing recipe..."

#### Ingredient Review Modal

After scraping, show a review step for converted ingredients:

```
┌─────────────────────────────────────────────────────────────────────┐
│  Review Converted Ingredients                                       │
│                                                                     │
│  We've converted units to metric. Please review:                    │
│                                                                     │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │  Original              →  Converted                            │ │
│  ├────────────────────────────────────────────────────────────────┤ │
│  │  1 cup flour           →  120g flour                    [Edit] │ │
│  │  2 tablespoons butter  →  30g butter                    [Edit] │ │
│  │  1/2 teaspoon salt     →  2.5ml salt              ⚠️    [Edit] │ │
│  │  Salt to taste         →  Salt to taste (no change)     [ ✓ ] │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ⚠️ = low confidence conversion, please verify                      │
│                                                                     │
│                          [Cancel]  [Confirm & Import]               │
└─────────────────────────────────────────────────────────────────────┘
```

**Interaction**:
- Each row shows original → converted with confidence indicator
- [Edit] opens inline editing for that ingredient
- ⚠️ icon highlights low-confidence conversions
- User must confirm before form is populated
- "Confirm & Import" applies all (edited) values to the form

**JavaScript additions**:

```typescript
interface IngredientReview {
  original: string;
  converted: { amount: string; name: string };
  confidence: 'high' | 'medium' | 'low';
  userEdited: boolean;
}

function showIngredientReviewModal(ingredients: ParsedIngredient[]): Promise<ReviewResult>
function renderIngredientRow(ing: IngredientReview): HTMLElement
function handleIngredientEdit(index: number): void
function confirmIngredients(): void
```

---

## Image Handling

Images are downloaded server-side during scrape to ensure they're available.

### Flow

1. Extract `imageUrl` from recipe data (JSON-LD `image` field or `<img>` in recipe)
2. Download image in `/api/scrape` endpoint
3. Process with sharp (same as form upload):
   - Full size: max 1200px wide, WebP, quality 85
   - Thumbnail: 400px wide, WebP, quality 80
4. Save to `/public/images/submissions/scrape-{timestamp}.webp`
5. Return local paths in response

### Why Server-Side?

- User sees image preview immediately after import
- No CORS issues with external images
- Image guaranteed to exist when form is submitted
- Consistent processing with manual uploads

---

## File Changes

| File | Change Type | Description |
|------|-------------|-------------|
| `src/lib/scraper.ts` | New | Scraping and parsing logic |
| `src/pages/api/scrape.ts` | New | API endpoint |
| `src/pages/submit.astro` | Modify | Add import UI and JS |

---

## Implementation Order

### Phase 1: Core Scraping

1. Create `src/lib/scraper.ts`
   - `ScrapedRecipe` type definition
   - `extractJsonLd()` function
   - `parseIngredient()` function
   - `parseDuration()` for ISO 8601 times

2. Create `src/pages/api/scrape.ts`
   - URL validation
   - Rate limiting
   - HTML fetching
   - Call scraper library
   - Return JSON response

### Phase 2: Image Processing

3. Add image download to `/api/scrape`
   - Fetch external image
   - Process with sharp
   - Save locally
   - Return paths

### Phase 3: UI Integration

4. Update `src/pages/submit.astro`
   - Add import URL input and button
   - Add `handleImport()` function
   - Add ingredient review modal
   - Add `populateForm()` function
   - Loading and error states

### Phase 4: Polish

5. Add HTML fallback parsing (optional, for sites without JSON-LD)
6. Handle edge cases in ingredient parsing
7. Add retry logic for flaky fetches

---

## Supported Sites (JSON-LD)

These sites include Schema.org Recipe data and should work out of the box:

- Serious Eats
- NYT Cooking
- AllRecipes
- Food Network
- Bon Appetit
- Epicurious
- BBC Good Food
- Tasty
- Delish
- Food52

---

## Error Handling

| Scenario | User Message |
|----------|--------------|
| Invalid URL | "Please enter a valid URL" |
| Site unreachable | "Could not reach that website" |
| No recipe found | "No recipe found on that page" |
| Rate limited | "Too many requests, please wait" |
| Image download failed | Recipe imports without image (non-blocking) |

---

## Security Considerations

- **URL validation**: Only allow HTTP/HTTPS protocols
- **Rate limiting**: Prevent abuse (10 requests/minute)
- **User-Agent**: Use identifiable UA to respect robots.txt spirit
- **Timeout**: 10-second fetch timeout to prevent hanging
- **Size limit**: Don't download images larger than 10MB
- **Content-Type check**: Verify response is HTML before parsing

---

## Parsing Reference Tables

### Word Numbers

```typescript
const WORD_NUMBERS: Record<string, number> = {
  'one': 1, 'two': 2, 'three': 3, 'four': 4, 'five': 5,
  'six': 6, 'seven': 7, 'eight': 8, 'nine': 9, 'ten': 10,
  'eleven': 11, 'twelve': 12, 'a': 1, 'an': 1,
};
```

### Fraction Conversion

```typescript
const FRACTIONS: Record<string, number> = {
  '½': 0.5, '⅓': 0.33, '⅔': 0.67, '¼': 0.25, '¾': 0.75,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
  '1/2': 0.5, '1/3': 0.33, '2/3': 0.67, '1/4': 0.25, '3/4': 0.75,
  '1/8': 0.125, '3/8': 0.375, '5/8': 0.625, '7/8': 0.875,
};
```

### Unit Aliases (Normalize First)

```typescript
const UNIT_ALIASES: Record<string, string> = {
  // Volume
  'tablespoon': 'tbsp', 'tablespoons': 'tbsp', 'T': 'tbsp', 'Tbsp': 'tbsp',
  'teaspoon': 'tsp', 'teaspoons': 'tsp', 't': 'tsp',
  'cup': 'cup', 'cups': 'cup', 'c': 'cup', 'C': 'cup',
  'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz', 'fl. oz.': 'fl oz',
  'pint': 'pint', 'pints': 'pint', 'pt': 'pint',
  'quart': 'quart', 'quarts': 'quart', 'qt': 'quart',
  'gallon': 'gallon', 'gallons': 'gallon', 'gal': 'gallon',
  'liter': 'L', 'liters': 'L', 'litre': 'L', 'litres': 'L', 'l': 'L',
  'milliliter': 'ml', 'milliliters': 'ml', 'millilitre': 'ml', 'mL': 'ml',

  // Weight
  'ounce': 'oz', 'ounces': 'oz', 'oz.': 'oz',
  'pound': 'lb', 'pounds': 'lb', 'lb.': 'lb', 'lbs': 'lb',
  'gram': 'g', 'grams': 'g', 'gr': 'g',
  'kilogram': 'kg', 'kilograms': 'kg', 'kilo': 'kg',

  // Length (for "1 inch piece of ginger")
  'inch': 'cm', 'inches': 'cm', 'in': 'cm', '"': 'cm',
};
```

### Volume to Metric Conversion

```typescript
const VOLUME_TO_ML: Record<string, number> = {
  'tsp': 5,
  'tbsp': 15,
  'fl oz': 30,
  'cup': 240,
  'pint': 473,
  'quart': 946,
  'gallon': 3785,
};
```

### Weight to Metric Conversion

```typescript
const WEIGHT_TO_G: Record<string, number> = {
  'oz': 28,
  'lb': 454,
};

const LENGTH_TO_CM: Record<string, number> = {
  'inch': 2.5,
};
```

### Common Ingredient Densities (g per cup)

Used for converting volume → weight for dry ingredients:

```typescript
const INGREDIENT_DENSITY: Record<string, number> = {
  // Flours
  'flour': 120,
  'all-purpose flour': 120,
  'bread flour': 127,
  'whole wheat flour': 113,
  'cake flour': 114,
  'almond flour': 96,

  // Sugars
  'sugar': 200,
  'granulated sugar': 200,
  'white sugar': 200,
  'brown sugar': 220,
  'powdered sugar': 120,
  'confectioners sugar': 120,
  'icing sugar': 120,

  // Fats
  'butter': 227,
  'oil': 218,
  'vegetable oil': 218,
  'olive oil': 218,
  'coconut oil': 218,

  // Liquids
  'water': 240,
  'milk': 245,
  'cream': 240,
  'heavy cream': 240,
  'buttermilk': 245,
  'yogurt': 245,
  'sour cream': 240,
  'honey': 340,
  'maple syrup': 322,
  'molasses': 340,

  // Grains
  'rice': 185,
  'oats': 90,
  'rolled oats': 90,
  'breadcrumbs': 108,

  // Nuts & Seeds
  'almonds': 143,
  'walnuts': 120,
  'pecans': 109,
  'peanuts': 146,

  // Dairy
  'parmesan': 100,
  'cheddar': 113,
  'cream cheese': 232,

  // Misc
  'cocoa powder': 85,
  'cornstarch': 128,
  'baking powder': 230,
  'baking soda': 220,
  'salt': 288,
  'yeast': 192,
};
```

### Parsing Algorithm

```typescript
function parseIngredient(text: string): ParsedIngredient {
  const original = text.trim();

  // 1. Normalize Unicode fractions and word numbers
  let normalized = replaceWordNumbers(original);
  normalized = replaceFractions(normalized);

  // 2. Extract numeric amount with regex
  // Matches: "1", "1.5", "1-2", "1 to 2", "1 1/2"
  const amountMatch = normalized.match(/^([\d\.\-\/\s]+(?:to\s*[\d\.]+)?)/i);

  if (!amountMatch) {
    // No amount found - return as name only
    return { original, amount: '', name: original, converted: false, confidence: 'high' };
  }

  const amountStr = amountMatch[1].trim();
  const remainder = normalized.slice(amountMatch[0].length).trim();

  // 3. Extract unit
  const unitMatch = remainder.match(/^(\w+\.?\s*\w*\.?)\s+/);
  const unit = unitMatch ? normalizeUnit(unitMatch[1]) : null;
  const name = unitMatch ? remainder.slice(unitMatch[0].length) : remainder;

  // 4. Convert to metric
  if (unit && isImperialUnit(unit)) {
    const converted = convertToMetric(parseFloat(amountStr), unit, name);
    return {
      original,
      amount: converted.amount,
      name: name,
      converted: true,
      confidence: converted.confidence,
    };
  }

  // 5. Already metric or no unit
  return {
    original,
    amount: unit ? `${amountStr}${unit}` : amountStr,
    name: name,
    converted: false,
    confidence: 'high',
  };
}
```

---

## Future Enhancements

- **Bookmarklet**: "Import to Kyburz Table" browser bookmarklet
- **Browser extension**: One-click import from any recipe page
- **Batch import**: Import multiple URLs at once
- **AI fallback**: Use Claude API to extract recipe from arbitrary HTML
