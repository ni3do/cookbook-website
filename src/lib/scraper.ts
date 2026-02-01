/**
 * Recipe Scraper Library
 *
 * Extracts recipe data from external URLs using Schema.org JSON-LD,
 * with intelligent ingredient parsing and imperial-to-metric conversion.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/** Confidence level for unit conversions */
export type ConversionConfidence = 'high' | 'medium' | 'low';

/** Parsed ingredient with conversion metadata */
export interface ParsedIngredient {
  /** Original text from the recipe */
  original: string;
  /** Converted amount (e.g., "120g") */
  amount: string;
  /** Ingredient name without the amount */
  name: string;
  /** Whether the unit was converted */
  converted: boolean;
  /** Confidence in the conversion accuracy */
  confidence: ConversionConfidence;
}

/** Scraped recipe data ready for form population */
export interface ScrapedRecipe {
  title: string;
  description?: string;
  prepTime?: number; // minutes
  cookTime?: number; // minutes
  servings?: number;
  ingredients: Array<{ amount: string; name: string }>;
  steps: string[];
  imageUrl?: string; // External URL (will be downloaded)
  imagePath?: string; // Local path after download
  thumbnailPath?: string; // Local thumbnail path
  sourceName?: string; // Site name (e.g., "Serious Eats")
  sourceUrl: string; // Original URL
}

// ─────────────────────────────────────────────────────────────────────────────
// Constants: Word Numbers
// ─────────────────────────────────────────────────────────────────────────────

/** Maps written numbers to digits */
export const WORD_NUMBERS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  a: 1,
  an: 1,
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants: Fractions
// ─────────────────────────────────────────────────────────────────────────────

/** Maps fraction characters and text to decimal values */
export const FRACTIONS: Record<string, number> = {
  // Unicode fraction characters
  '½': 0.5,
  '⅓': 0.33,
  '⅔': 0.67,
  '¼': 0.25,
  '¾': 0.75,
  '⅛': 0.125,
  '⅜': 0.375,
  '⅝': 0.625,
  '⅞': 0.875,
  // Text fractions
  '1/2': 0.5,
  '1/3': 0.33,
  '2/3': 0.67,
  '1/4': 0.25,
  '3/4': 0.75,
  '1/8': 0.125,
  '3/8': 0.375,
  '5/8': 0.625,
  '7/8': 0.875,
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants: Unit Aliases
// ─────────────────────────────────────────────────────────────────────────────

/** Normalizes various unit spellings to canonical forms */
export const UNIT_ALIASES: Record<string, string> = {
  // Volume - tablespoon
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  T: 'tbsp',
  Tbsp: 'tbsp',
  'tbl.': 'tbsp',
  tbl: 'tbsp',

  // Volume - teaspoon
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  t: 'tsp',
  'tsp.': 'tsp',

  // Volume - cup
  cup: 'cup',
  cups: 'cup',
  c: 'cup',
  C: 'cup',

  // Volume - fluid ounce
  'fluid ounce': 'fl oz',
  'fluid ounces': 'fl oz',
  'fl. oz.': 'fl oz',
  'fl oz': 'fl oz',
  'fl. oz': 'fl oz',
  floz: 'fl oz',

  // Volume - pint
  pint: 'pint',
  pints: 'pint',
  pt: 'pint',
  'pt.': 'pint',

  // Volume - quart
  quart: 'quart',
  quarts: 'quart',
  qt: 'quart',
  'qt.': 'quart',

  // Volume - gallon
  gallon: 'gallon',
  gallons: 'gallon',
  gal: 'gallon',
  'gal.': 'gallon',

  // Volume - liter
  liter: 'L',
  liters: 'L',
  litre: 'L',
  litres: 'L',
  l: 'L',
  'l.': 'L',

  // Volume - milliliter
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  ml: 'ml',
  mL: 'ml',
  'ml.': 'ml',

  // Weight - ounce
  ounce: 'oz',
  ounces: 'oz',
  'oz.': 'oz',
  oz: 'oz',

  // Weight - pound
  pound: 'lb',
  pounds: 'lb',
  'lb.': 'lb',
  lbs: 'lb',
  'lbs.': 'lb',
  lb: 'lb',

  // Weight - gram
  gram: 'g',
  grams: 'g',
  gr: 'g',
  'g.': 'g',
  g: 'g',

  // Weight - kilogram
  kilogram: 'kg',
  kilograms: 'kg',
  kilo: 'kg',
  kilos: 'kg',
  kg: 'kg',
  'kg.': 'kg',

  // Length (for "1 inch piece of ginger")
  inch: 'inch',
  inches: 'inch',
  in: 'inch',
  '"': 'inch',
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants: Volume to Metric
// ─────────────────────────────────────────────────────────────────────────────

/** Converts volume units to milliliters */
export const VOLUME_TO_ML: Record<string, number> = {
  tsp: 5,
  tbsp: 15,
  'fl oz': 30,
  cup: 240,
  pint: 473,
  quart: 946,
  gallon: 3785,
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants: Weight to Metric
// ─────────────────────────────────────────────────────────────────────────────

/** Converts weight units to grams */
export const WEIGHT_TO_G: Record<string, number> = {
  oz: 28,
  lb: 454,
};

/** Converts length units to centimeters */
export const LENGTH_TO_CM: Record<string, number> = {
  inch: 2.5,
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants: Ingredient Densities (grams per cup)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Maps common ingredients to their weight in grams per cup.
 * Used for converting volume measurements to weight for dry ingredients.
 */
export const INGREDIENT_DENSITY: Record<string, number> = {
  // Flours
  flour: 120,
  'all-purpose flour': 120,
  'ap flour': 120,
  'plain flour': 120,
  'bread flour': 127,
  'whole wheat flour': 113,
  'whole-wheat flour': 113,
  'cake flour': 114,
  'almond flour': 96,
  'almond meal': 96,
  'coconut flour': 112,
  'rice flour': 158,

  // Sugars
  sugar: 200,
  'granulated sugar': 200,
  'white sugar': 200,
  'caster sugar': 200,
  'brown sugar': 220,
  'light brown sugar': 220,
  'dark brown sugar': 220,
  'packed brown sugar': 220,
  'powdered sugar': 120,
  "confectioners' sugar": 120,
  'confectioners sugar': 120,
  'icing sugar': 120,

  // Fats
  butter: 227,
  'unsalted butter': 227,
  'salted butter': 227,
  oil: 218,
  'vegetable oil': 218,
  'olive oil': 218,
  'canola oil': 218,
  'coconut oil': 218,
  shortening: 191,

  // Liquids
  water: 240,
  milk: 245,
  'whole milk': 245,
  cream: 240,
  'heavy cream': 240,
  'whipping cream': 240,
  buttermilk: 245,
  yogurt: 245,
  'greek yogurt': 280,
  'sour cream': 240,
  honey: 340,
  'maple syrup': 322,
  molasses: 340,
  'corn syrup': 328,

  // Grains
  rice: 185,
  'white rice': 185,
  'brown rice': 190,
  oats: 90,
  'rolled oats': 90,
  'old-fashioned oats': 90,
  'quick oats': 80,
  breadcrumbs: 108,
  'panko breadcrumbs': 60,
  quinoa: 170,
  couscous: 175,

  // Nuts & Seeds
  almonds: 143,
  'sliced almonds': 92,
  walnuts: 120,
  'chopped walnuts': 120,
  pecans: 109,
  'chopped pecans': 109,
  peanuts: 146,
  cashews: 137,
  'pine nuts': 135,

  // Dairy
  parmesan: 100,
  'grated parmesan': 100,
  cheddar: 113,
  'shredded cheddar': 113,
  'cream cheese': 232,
  'cottage cheese': 225,
  'ricotta cheese': 246,

  // Chocolate & Cocoa
  'cocoa powder': 85,
  'unsweetened cocoa': 85,
  'chocolate chips': 170,

  // Starches & Leaveners
  cornstarch: 128,
  'corn starch': 128,
  'baking powder': 230,
  'baking soda': 220,
  salt: 288,
  'kosher salt': 240,
  'table salt': 288,
  yeast: 192,
  'active dry yeast': 192,
  'instant yeast': 192,

  // Misc
  'peanut butter': 258,
  mayonnaise: 220,
  ketchup: 240,
  'soy sauce': 255,
};
