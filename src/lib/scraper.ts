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
  tbsp: 'tbsp',
  T: 'tbsp',
  Tbsp: 'tbsp',
  'tbl.': 'tbsp',
  tbl: 'tbsp',

  // Volume - teaspoon
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  tsp: 'tsp',
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

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parses an ISO 8601 duration string to minutes.
 *
 * @example
 * parseDuration('PT30M')    // 30
 * parseDuration('PT1H')     // 60
 * parseDuration('PT1H30M')  // 90
 * parseDuration('PT2H15M')  // 135
 * parseDuration('45')       // 45 (fallback for plain numbers)
 */
export function parseDuration(duration: string | undefined | null): number | undefined {
  if (!duration) return undefined;

  // Handle plain numbers (some sites just use "30" for 30 minutes)
  const plainNumber = parseInt(duration, 10);
  if (!isNaN(plainNumber) && /^\d+$/.test(duration.trim())) {
    return plainNumber;
  }

  // ISO 8601 duration format: PT[n]H[n]M[n]S
  const match = duration.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return undefined;

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  // Convert to total minutes, rounding seconds
  const totalMinutes = hours * 60 + minutes + Math.round(seconds / 60);

  return totalMinutes > 0 ? totalMinutes : undefined;
}

/**
 * Replaces word numbers with their digit equivalents.
 * Handles common words like "one", "two", "a", "an", etc.
 *
 * @example
 * replaceWordNumbers('one cup flour')     // '1 cup flour'
 * replaceWordNumbers('a pinch of salt')   // '1 pinch of salt'
 * replaceWordNumbers('two large eggs')    // '2 large eggs'
 */
export function replaceWordNumbers(text: string): string {
  let result = text;

  // Sort by length descending to replace longer words first
  // (e.g., "eleven" before "one" to avoid partial matches)
  const sortedWords = Object.keys(WORD_NUMBERS).sort((a, b) => b.length - a.length);

  for (const word of sortedWords) {
    // Word boundary match, case-insensitive
    // Only match at the start of the string or after whitespace
    const regex = new RegExp(`(^|\\s)${word}(?=\\s|$)`, 'gi');
    result = result.replace(regex, `$1${WORD_NUMBERS[word]}`);
  }

  return result;
}

/**
 * Replaces fraction characters and text fractions with decimal equivalents.
 * Handles mixed numbers like "1 ½" → "1.5".
 *
 * @example
 * replaceFractions('½ cup flour')     // '0.5 cup flour'
 * replaceFractions('1 ½ cups sugar')  // '1.5 cups sugar'
 * replaceFractions('1/4 tsp salt')    // '0.25 tsp salt'
 * replaceFractions('2 1/2 tbsp oil')  // '2.5 tbsp oil'
 */
export function replaceFractions(text: string): string {
  let result = text;

  // First, handle mixed numbers with Unicode fractions (e.g., "1 ½" → "1.5")
  for (const [fraction, decimal] of Object.entries(FRACTIONS)) {
    // Only process single-character Unicode fractions for mixed number handling
    if (fraction.length === 1) {
      // Match "N ½" or "N½" patterns (whole number followed by fraction)
      const mixedRegex = new RegExp(`(\\d+)\\s*${fraction}`, 'g');
      result = result.replace(mixedRegex, (_, whole) => {
        return String(parseFloat(whole) + decimal);
      });
    }
  }

  // Then handle mixed numbers with text fractions (e.g., "2 1/2" → "2.5")
  result = result.replace(/(\d+)\s+(\d+)\/(\d+)/g, (_, whole, num, denom) => {
    const wholeNum = parseFloat(whole);
    const fractionVal = parseFloat(num) / parseFloat(denom);
    return String(wholeNum + fractionVal);
  });

  // Finally, replace standalone fractions
  // Sort by length descending to handle "1/2" before trying to match parts
  const sortedFractions = Object.keys(FRACTIONS).sort((a, b) => b.length - a.length);

  for (const fraction of sortedFractions) {
    const decimal = FRACTIONS[fraction];
    // Escape special regex characters in the fraction
    const escaped = fraction.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'g');
    result = result.replace(regex, String(decimal));
  }

  return result;
}

/**
 * Normalizes a unit string to its canonical form.
 * Handles various spellings, abbreviations, and plurals.
 *
 * @example
 * normalizeUnit('tablespoon')   // 'tbsp'
 * normalizeUnit('cups')         // 'cup'
 * normalizeUnit('oz.')          // 'oz'
 * normalizeUnit('pounds')       // 'lb'
 */
export function normalizeUnit(unit: string): string | null {
  if (!unit) return null;

  const normalized = unit.toLowerCase().trim();

  // Direct lookup in aliases
  if (normalized in UNIT_ALIASES) {
    return UNIT_ALIASES[normalized];
  }

  // Check without trailing periods
  const withoutPeriod = normalized.replace(/\.$/, '');
  if (withoutPeriod in UNIT_ALIASES) {
    return UNIT_ALIASES[withoutPeriod];
  }

  // Not a recognized unit
  return null;
}

/** Imperial volume units that need conversion to metric */
const IMPERIAL_VOLUME_UNITS = new Set(['tsp', 'tbsp', 'fl oz', 'cup', 'pint', 'quart', 'gallon']);

/** Imperial weight units that need conversion to metric */
const IMPERIAL_WEIGHT_UNITS = new Set(['oz', 'lb']);

/** Imperial length units that need conversion to metric */
const IMPERIAL_LENGTH_UNITS = new Set(['inch']);

/**
 * Checks if a unit is an imperial unit that should be converted to metric.
 *
 * @example
 * isImperialUnit('cup')   // true
 * isImperialUnit('oz')    // true
 * isImperialUnit('g')     // false
 * isImperialUnit('ml')    // false
 */
export function isImperialUnit(unit: string): boolean {
  return (
    IMPERIAL_VOLUME_UNITS.has(unit) ||
    IMPERIAL_WEIGHT_UNITS.has(unit) ||
    IMPERIAL_LENGTH_UNITS.has(unit)
  );
}

/**
 * Finds the density (grams per cup) for an ingredient using fuzzy matching.
 * Returns undefined if no match is found.
 *
 * @example
 * findIngredientDensity('flour')                    // 120
 * findIngredientDensity('all-purpose flour, sifted') // 120
 * findIngredientDensity('brown sugar')               // 220
 * findIngredientDensity('mystery ingredient')        // undefined
 */
export function findIngredientDensity(ingredientName: string): number | undefined {
  const normalized = ingredientName.toLowerCase().trim();

  // 1. Try exact match
  if (normalized in INGREDIENT_DENSITY) {
    return INGREDIENT_DENSITY[normalized];
  }

  // 2. Try matching any density key as a substring of the ingredient
  // Sort keys by length (longest first) to match more specific ingredients first
  const sortedKeys = Object.keys(INGREDIENT_DENSITY).sort((a, b) => b.length - a.length);

  for (const key of sortedKeys) {
    // Check if the key appears as a whole word in the ingredient name
    const keyRegex = new RegExp(`\\b${key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (keyRegex.test(normalized)) {
      return INGREDIENT_DENSITY[key];
    }
  }

  // 3. Try the first word of the ingredient (often the main ingredient)
  const firstWord = normalized.split(/[\s,]+/)[0];
  if (firstWord && firstWord in INGREDIENT_DENSITY) {
    return INGREDIENT_DENSITY[firstWord];
  }

  return undefined;
}

/** Result of a metric conversion */
interface ConversionResult {
  /** The converted amount with unit (e.g., "120g", "15ml") */
  amount: string;
  /** Confidence level in the conversion */
  confidence: ConversionConfidence;
}

/**
 * Formats a number for display, avoiding unnecessary decimal places.
 * Values ≥10 are rounded to integers; smaller values get one decimal.
 */
function formatAmount(value: number): string {
  if (value >= 10) {
    return String(Math.round(value));
  }
  // One decimal place for small values
  const rounded = Math.round(value * 10) / 10;
  return rounded % 1 === 0 ? String(rounded) : rounded.toFixed(1);
}

/**
 * Parses an amount string that may contain ranges or multiple values.
 * Returns the primary value for conversion purposes.
 *
 * @example
 * parseAmountValue('1.5')     // 1.5
 * parseAmountValue('1-2')     // 1.5 (average)
 * parseAmountValue('1 to 2')  // 1.5 (average)
 */
function parseAmountValue(amountStr: string): number | null {
  // Handle ranges: "1-2" or "1 to 2"
  const rangeMatch = amountStr.match(/^([\d.]+)\s*(?:-|to)\s*([\d.]+)$/i);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    if (!isNaN(low) && !isNaN(high)) {
      // Return average for conversion
      return (low + high) / 2;
    }
  }

  // Simple number
  const num = parseFloat(amountStr);
  return isNaN(num) ? null : num;
}

/**
 * Formats a range after conversion, preserving the range notation.
 */
function formatRange(amountStr: string, conversionFactor: number, suffix: string): string {
  const rangeMatch = amountStr.match(/^([\d.]+)\s*(-|to)\s*([\d.]+)$/i);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]) * conversionFactor;
    const high = parseFloat(rangeMatch[3]) * conversionFactor;
    const sep = rangeMatch[2] === 'to' ? ' to ' : '-';
    return `${formatAmount(low)}${sep}${formatAmount(high)}${suffix}`;
  }
  return `${formatAmount(parseFloat(amountStr) * conversionFactor)}${suffix}`;
}

/**
 * Converts an imperial measurement to metric.
 *
 * Conversion strategy:
 * - Weight (oz, lb): Direct conversion to grams (high confidence)
 * - Volume with known density: Convert to grams (high confidence)
 * - Volume without density: Convert to ml (medium confidence)
 * - Length (inch): Convert to cm (high confidence)
 *
 * @param amount - Numeric amount to convert
 * @param unit - Canonical unit (from normalizeUnit)
 * @param ingredientName - Name of ingredient for density lookup
 *
 * @example
 * convertToMetric(1, 'cup', 'flour')      // { amount: '120g', confidence: 'high' }
 * convertToMetric(2, 'tbsp', 'butter')    // { amount: '30g', confidence: 'high' }
 * convertToMetric(1, 'cup', 'water')      // { amount: '240ml', confidence: 'high' }
 * convertToMetric(8, 'oz', 'chicken')     // { amount: '224g', confidence: 'high' }
 */
export function convertToMetric(
  amount: number,
  unit: string,
  ingredientName: string
): ConversionResult {
  // Handle weight conversions (always high confidence)
  if (unit in WEIGHT_TO_G) {
    const grams = amount * WEIGHT_TO_G[unit];
    return {
      amount: `${formatAmount(grams)}g`,
      confidence: 'high',
    };
  }

  // Handle length conversions (high confidence)
  if (unit in LENGTH_TO_CM) {
    const cm = amount * LENGTH_TO_CM[unit];
    return {
      amount: `${formatAmount(cm)}cm`,
      confidence: 'high',
    };
  }

  // Handle volume conversions
  if (unit in VOLUME_TO_ML) {
    const mlPerUnit = VOLUME_TO_ML[unit];

    // Try to find ingredient density for volume → weight conversion
    const density = findIngredientDensity(ingredientName);

    if (density) {
      // Convert cups to grams using density
      // Density is in grams per cup, so we need to scale for other units
      const cupsEquivalent = (amount * mlPerUnit) / 240; // 240ml = 1 cup
      const grams = cupsEquivalent * density;

      return {
        amount: `${formatAmount(grams)}g`,
        confidence: 'high',
      };
    }

    // No density found - convert to ml
    const ml = amount * mlPerUnit;

    // Use 'medium' confidence for volume conversions without density
    // Exception: small amounts (tsp, tbsp) where ml is appropriate
    const confidence: ConversionConfidence =
      unit === 'tsp' || unit === 'tbsp' ? 'high' : 'medium';

    return {
      amount: `${formatAmount(ml)}ml`,
      confidence,
    };
  }

  // Unknown unit - return as-is with low confidence
  return {
    amount: `${formatAmount(amount)}${unit}`,
    confidence: 'low',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Core Parsing Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Regex to match amount at the start of an ingredient string.
 * Matches: "1", "1.5", "1-2", "1 to 2", "1.5-2.5"
 */
const AMOUNT_REGEX = /^([\d.]+(?:\s*(?:-|to)\s*[\d.]+)?)\s*/i;

/**
 * Known units pattern for matching after the amount.
 * This list covers common cooking units and their variations.
 */
const UNIT_PATTERN = [
  // Volume - multi-word first
  'fluid ounces?',
  'fl\\.? oz\\.?',
  // Volume - single word
  'tablespoons?',
  'teaspoons?',
  'tbsp\\.?',
  'tsp\\.?',
  'cups?',
  'pints?',
  'quarts?',
  'gallons?',
  'liters?',
  'litres?',
  'milliliters?',
  'millilitres?',
  'ml',
  'mL',
  'pt\\.?',
  'qt\\.?',
  'gal\\.?',
  // Weight
  'ounces?',
  'pounds?',
  'oz\\.?',
  'lbs?\\.?',
  'grams?',
  'kilograms?',
  'kilos?',
  'kg\\.?',
  'g\\.?',
  // Length
  'inch(?:es)?',
  'in\\.?',
  '"',
  // Short forms that might conflict - must match with word boundary
  'T',
  't',
  'c',
  'C',
  'l',
  'L',
].join('|');

const UNIT_REGEX = new RegExp(`^(${UNIT_PATTERN})(?:\\s+|$)`, 'i');

/**
 * Parses an ingredient string into structured data with metric conversion.
 *
 * @param text - Raw ingredient string (e.g., "1 cup all-purpose flour")
 * @returns ParsedIngredient with original, converted amount, name, and confidence
 *
 * @example
 * parseIngredient('1 cup flour')
 * // { original: '1 cup flour', amount: '120g', name: 'flour', converted: true, confidence: 'high' }
 *
 * parseIngredient('2 tablespoons butter')
 * // { original: '2 tablespoons butter', amount: '30g', name: 'butter', converted: true, confidence: 'high' }
 *
 * parseIngredient('Salt to taste')
 * // { original: 'Salt to taste', amount: '', name: 'Salt to taste', converted: false, confidence: 'high' }
 *
 * parseIngredient('1-2 tbsp olive oil')
 * // { original: '1-2 tbsp olive oil', amount: '15-30ml', name: 'olive oil', converted: true, confidence: 'high' }
 */
export function parseIngredient(text: string): ParsedIngredient {
  const original = text.trim();

  // Step 1: Normalize word numbers and fractions
  let normalized = replaceWordNumbers(original);
  normalized = replaceFractions(normalized);

  // Step 2: Extract numeric amount
  const amountMatch = normalized.match(AMOUNT_REGEX);

  if (!amountMatch) {
    // No amount found - return entire text as name
    return {
      original,
      amount: '',
      name: original,
      converted: false,
      confidence: 'high',
    };
  }

  const amountStr = amountMatch[1].trim();
  let remainder = normalized.slice(amountMatch[0].length).trim();

  // Step 3: Extract unit
  const unitMatch = remainder.match(UNIT_REGEX);
  let unit: string | null = null;
  let name = remainder;

  if (unitMatch) {
    const rawUnit = unitMatch[1];
    unit = normalizeUnit(rawUnit);
    name = remainder.slice(unitMatch[0].length).trim();
  }

  // Step 4: Convert imperial units to metric
  if (unit && isImperialUnit(unit)) {
    const numericAmount = parseAmountValue(amountStr);

    if (numericAmount !== null) {
      // Check if it's a range for special formatting
      const isRange = /[-]|to/i.test(amountStr);

      if (isRange) {
        // Handle range conversion
        const converted = convertToMetric(numericAmount, unit, name);
        // Extract the conversion factor from the result
        const convFactor = getConversionFactor(unit, name);
        const suffix = converted.amount.replace(/[\d.\-\s]+/, '');

        return {
          original,
          amount: formatRange(amountStr, convFactor, suffix),
          name,
          converted: true,
          confidence: converted.confidence,
        };
      }

      // Simple amount conversion
      const converted = convertToMetric(numericAmount, unit, name);
      return {
        original,
        amount: converted.amount,
        name,
        converted: true,
        confidence: converted.confidence,
      };
    }
  }

  // Step 5: Already metric or no recognized unit
  const finalAmount = unit ? `${amountStr}${unit}` : amountStr;

  return {
    original,
    amount: finalAmount,
    name,
    converted: false,
    confidence: 'high',
  };
}

/**
 * Gets the conversion factor for a unit (used for range formatting).
 */
function getConversionFactor(unit: string, ingredientName: string): number {
  // Weight conversions
  if (unit in WEIGHT_TO_G) {
    return WEIGHT_TO_G[unit];
  }

  // Length conversions
  if (unit in LENGTH_TO_CM) {
    return LENGTH_TO_CM[unit];
  }

  // Volume conversions
  if (unit in VOLUME_TO_ML) {
    const mlPerUnit = VOLUME_TO_ML[unit];
    const density = findIngredientDensity(ingredientName);

    if (density) {
      // Convert to grams using density
      const cupsEquivalent = mlPerUnit / 240;
      return cupsEquivalent * density;
    }

    // Convert to ml
    return mlPerUnit;
  }

  return 1;
}

// ─────────────────────────────────────────────────────────────────────────────
// JSON-LD Extraction
// ─────────────────────────────────────────────────────────────────────────────

/** Schema.org Recipe type (subset of fields we care about) */
interface SchemaRecipe {
  '@type': string | string[];
  name?: string;
  description?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string | number | string[];
  recipeIngredient?: string[];
  recipeInstructions?: SchemaInstruction[] | string[] | string;
  image?: string | string[] | { url: string } | { url: string }[];
}

/** Schema.org HowToStep or HowToSection */
interface SchemaInstruction {
  '@type'?: string;
  text?: string;
  name?: string;
  itemListElement?: (SchemaInstruction | string)[];
}

/**
 * Extracts a Schema.org Recipe from HTML using JSON-LD.
 *
 * Handles:
 * - Single Recipe objects
 * - @graph arrays containing Recipe
 * - Multiple JSON-LD script tags
 * - Various image formats (string, array, object)
 * - HowToStep and HowToSection instructions
 *
 * @param html - Raw HTML string to parse
 * @returns ScrapedRecipe if found, null otherwise
 *
 * @example
 * const html = await fetch(url).then(r => r.text());
 * const recipe = extractJsonLd(html);
 * if (recipe) {
 *   console.log(recipe.title); // "Lemon Pasta"
 * }
 */
export function extractJsonLd(html: string): Omit<ScrapedRecipe, 'sourceUrl'> | null {
  // Find all JSON-LD script tags
  const jsonLdRegex = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = jsonLdRegex.exec(html)) !== null) {
    try {
      const jsonText = match[1].trim();
      const data = JSON.parse(jsonText);

      // Try to find a Recipe in this JSON-LD block
      const recipe = findRecipeInJsonLd(data);
      if (recipe) {
        return parseSchemaRecipe(recipe);
      }
    } catch {
      // Invalid JSON, try next script tag
      continue;
    }
  }

  return null;
}

/**
 * Recursively searches for a Recipe object in JSON-LD data.
 */
function findRecipeInJsonLd(data: unknown): SchemaRecipe | null {
  if (!data || typeof data !== 'object') {
    return null;
  }

  // Check if this object is a Recipe
  if (isRecipeType(data)) {
    return data as SchemaRecipe;
  }

  // Check @graph array
  if ('@graph' in data && Array.isArray((data as { '@graph': unknown[] })['@graph'])) {
    for (const item of (data as { '@graph': unknown[] })['@graph']) {
      if (isRecipeType(item)) {
        return item as SchemaRecipe;
      }
    }
  }

  // Check if it's an array at the root
  if (Array.isArray(data)) {
    for (const item of data) {
      const recipe = findRecipeInJsonLd(item);
      if (recipe) {
        return recipe;
      }
    }
  }

  return null;
}

/**
 * Checks if an object has @type of "Recipe".
 */
function isRecipeType(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') {
    return false;
  }

  const typed = obj as { '@type'?: string | string[] };
  if (!typed['@type']) {
    return false;
  }

  const types = Array.isArray(typed['@type']) ? typed['@type'] : [typed['@type']];
  return types.some((t) => t === 'Recipe' || t === 'https://schema.org/Recipe');
}

/**
 * Converts a Schema.org Recipe to our ScrapedRecipe format.
 */
function parseSchemaRecipe(schema: SchemaRecipe): Omit<ScrapedRecipe, 'sourceUrl'> {
  return {
    title: schema.name || 'Untitled Recipe',
    description: schema.description,
    prepTime: parseDuration(schema.prepTime),
    cookTime: parseDuration(schema.cookTime),
    servings: parseServings(schema.recipeYield),
    ingredients: parseIngredients(schema.recipeIngredient),
    steps: parseInstructions(schema.recipeInstructions),
    imageUrl: parseImageUrl(schema.image),
  };
}

/**
 * Parses recipeYield to a number of servings.
 */
function parseServings(yield_: string | number | string[] | undefined): number | undefined {
  if (yield_ === undefined) {
    return undefined;
  }

  // Handle array (take first)
  if (Array.isArray(yield_)) {
    return parseServings(yield_[0]);
  }

  // Handle number directly
  if (typeof yield_ === 'number') {
    return yield_;
  }

  // Handle string - extract first number
  const match = yield_.match(/(\d+)/);
  return match ? parseInt(match[1], 10) : undefined;
}

/**
 * Parses recipeIngredient array with metric conversion.
 */
function parseIngredients(
  ingredients: string[] | undefined
): Array<{ amount: string; name: string }> {
  if (!ingredients || !Array.isArray(ingredients)) {
    return [];
  }

  return ingredients.map((text) => {
    const parsed = parseIngredient(text);
    return {
      amount: parsed.amount,
      name: parsed.name,
    };
  });
}

/**
 * Parses recipeInstructions to an array of step strings.
 * Handles HowToStep, HowToSection, plain strings, and single string with newlines.
 */
function parseInstructions(
  instructions: SchemaInstruction[] | string[] | string | undefined
): string[] {
  if (!instructions) {
    return [];
  }

  // Single string - split by newlines or return as single step
  if (typeof instructions === 'string') {
    const lines = instructions
      .split(/\n+/)
      .map((s) => s.trim())
      .filter(Boolean);
    return lines.length > 0 ? lines : [instructions];
  }

  // Array of strings or objects
  const steps: string[] = [];

  for (const item of instructions) {
    if (typeof item === 'string') {
      steps.push(item.trim());
    } else if (item && typeof item === 'object') {
      // HowToSection with nested steps
      if (item['@type'] === 'HowToSection' && item.itemListElement) {
        for (const subItem of item.itemListElement) {
          if (typeof subItem === 'string') {
            steps.push(subItem.trim());
          } else if (subItem.text) {
            steps.push(subItem.text.trim());
          }
        }
      }
      // HowToStep
      else if (item.text) {
        steps.push(item.text.trim());
      }
      // Object with just name
      else if (item.name) {
        steps.push(item.name.trim());
      }
    }
  }

  return steps.filter(Boolean);
}

/**
 * Extracts image URL from various Schema.org image formats.
 */
function parseImageUrl(
  image: string | string[] | { url: string } | { url: string }[] | undefined
): string | undefined {
  if (!image) {
    return undefined;
  }

  // Direct string URL
  if (typeof image === 'string') {
    return image;
  }

  // Array - take first
  if (Array.isArray(image)) {
    const first = image[0];
    if (typeof first === 'string') {
      return first;
    }
    if (first && typeof first === 'object' && 'url' in first) {
      return first.url;
    }
    return undefined;
  }

  // Object with url property
  if (typeof image === 'object' && 'url' in image) {
    return image.url;
  }

  return undefined;
}
