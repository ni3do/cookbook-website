/**
 * Ingredient Parser and Deduplication Utilities
 *
 * Parses ingredient strings to extract amounts, units, and names,
 * and provides functions to merge duplicate ingredients.
 */

import type { ShoppingListItem } from './shoppingList';

/**
 * Parsed ingredient data.
 */
export interface ParsedIngredient {
  amount: number | null;
  unit: string;
  name: string;
  raw: string;
}

/**
 * Merged ingredient for display.
 */
export interface MergedIngredient {
  amount: number | null;
  unit: string;
  name: string;
  recipeSlugs: string[];
}

/**
 * Unit normalization map - maps various spellings to canonical forms.
 */
const UNIT_ALIASES: Record<string, string> = {
  // Tablespoon
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tbs: 'tbsp',
  tb: 'tbsp',
  // Teaspoon
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  // Cup
  cups: 'cup',
  // Ounce
  ounce: 'oz',
  ounces: 'oz',
  // Pound
  pound: 'lb',
  pounds: 'lb',
  lbs: 'lb',
  // Gram
  gram: 'g',
  grams: 'g',
  // Kilogram
  kilogram: 'kg',
  kilograms: 'kg',
  // Milliliter
  milliliter: 'ml',
  milliliters: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  // Liter
  liter: 'l',
  liters: 'l',
  litre: 'l',
  litres: 'l',
  // Pinch
  pinches: 'pinch',
  // Clove
  cloves: 'clove',
  // Piece
  pieces: 'piece',
  // Bunch
  bunches: 'bunch',
  // Can
  cans: 'can',
  // Slice
  slices: 'slice',
  // Sprig
  sprigs: 'sprig',
  // Head
  heads: 'head',
  // Large/Medium/Small (normalize to singular)
  large: 'large',
  medium: 'medium',
  small: 'small',
};

/**
 * Common units that can appear directly after a number without spaces.
 * These are used to detect unit+name without separator (e.g., "400g pasta").
 */
const ATTACHED_UNITS = [
  'g',
  'kg',
  'ml',
  'l',
  'oz',
  'lb',
  'mg',
  'cl',
  'dl',
];

/**
 * Normalizes a unit string to its canonical form.
 * @param unit - The unit to normalize
 * @returns Normalized unit string (lowercase)
 */
export function normalizeUnit(unit: string): string {
  const lower = unit.toLowerCase().trim();
  return UNIT_ALIASES[lower] ?? lower;
}

/**
 * Parses a fraction string (e.g., "1/2", "3/4") to a number.
 * @param str - The fraction string
 * @returns The decimal value or null if not a valid fraction
 */
function parseFraction(str: string): number | null {
  const fractionMatch = str.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fractionMatch) {
    const [, numerator, denominator] = fractionMatch;
    const num = parseInt(numerator, 10);
    const den = parseInt(denominator, 10);
    if (den !== 0) {
      return num / den;
    }
  }
  return null;
}

/**
 * Parses a mixed number string (e.g., "1 1/2", "2 3/4") to a number.
 * @param str - The mixed number string
 * @returns The decimal value or null if not valid
 */
function parseMixedNumber(str: string): number | null {
  // Match patterns like "1 1/2" or "2 3/4"
  const mixedMatch = str.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) {
    const [, whole, numerator, denominator] = mixedMatch;
    const wholeNum = parseInt(whole, 10);
    const num = parseInt(numerator, 10);
    const den = parseInt(denominator, 10);
    if (den !== 0) {
      return wholeNum + num / den;
    }
  }
  return null;
}

/**
 * Parses a numeric value which can be an integer, decimal, fraction, or mixed number.
 * @param str - The string to parse
 * @returns The numeric value or null if not a valid number
 */
function parseNumber(str: string): number | null {
  const trimmed = str.trim();

  // Try mixed number first (e.g., "1 1/2")
  const mixed = parseMixedNumber(trimmed);
  if (mixed !== null) return mixed;

  // Try fraction (e.g., "1/2")
  const fraction = parseFraction(trimmed);
  if (fraction !== null) return fraction;

  // Try regular number (integer or decimal)
  const num = parseFloat(trimmed);
  if (!isNaN(num)) return num;

  return null;
}

/**
 * Parses an ingredient string to extract amount, unit, and ingredient name.
 *
 * Handles various formats:
 * - "400g spaghetti" - amount with attached unit
 * - "2 tbsp olive oil" - amount space unit space name
 * - "1/2 tsp salt" - fraction amount
 * - "2 lemons, zested" - count with description
 * - "Salt and pepper to taste" - no amount
 *
 * @param ingredientStr - The raw ingredient string
 * @returns Parsed ingredient object
 */
export function parseIngredient(ingredientStr: string): ParsedIngredient {
  const raw = ingredientStr.trim();
  let remaining = raw;

  // Try to match amount with attached unit (e.g., "400g", "100ml")
  const attachedUnitPattern = new RegExp(
    `^(\\d+(?:\\.\\d+)?)(${ATTACHED_UNITS.join('|')})\\s+(.+)$`,
    'i'
  );
  const attachedMatch = remaining.match(attachedUnitPattern);
  if (attachedMatch) {
    const [, amountStr, unit, name] = attachedMatch;
    return {
      amount: parseNumber(amountStr),
      unit: normalizeUnit(unit),
      name: name.trim(),
      raw,
    };
  }

  // Try to match amount (including fractions) followed by unit and name
  // Pattern: number/fraction, optional unit, name
  const fullPattern =
    /^(\d+(?:\s+\d+\/\d+|\.\d+|\/\d+)?)\s*([a-zA-Z]+)?\s*(.*)$/;
  const fullMatch = remaining.match(fullPattern);

  if (fullMatch) {
    const [, amountStr, unitOrName, rest] = fullMatch;
    const amount = parseNumber(amountStr);

    if (amount !== null) {
      // Check if the second capture is a known unit
      const potentialUnit = (unitOrName || '').toLowerCase();
      const isKnownUnit =
        potentialUnit in UNIT_ALIASES ||
        ATTACHED_UNITS.includes(potentialUnit) ||
        [
          'tbsp',
          'tsp',
          'cup',
          'oz',
          'lb',
          'pinch',
          'clove',
          'piece',
          'bunch',
          'can',
          'slice',
          'sprig',
          'head',
          'large',
          'medium',
          'small',
        ].includes(potentialUnit);

      if (isKnownUnit && rest) {
        return {
          amount,
          unit: normalizeUnit(potentialUnit),
          name: rest.trim(),
          raw,
        };
      }

      // No unit found, the second capture is part of the name
      const name = (unitOrName || '') + (rest ? ' ' + rest : '');
      return {
        amount,
        unit: '',
        name: name.trim(),
        raw,
      };
    }
  }

  // No amount found - return the whole string as the name
  return {
    amount: null,
    unit: '',
    name: raw,
    raw,
  };
}

/**
 * Simple singularization for common ingredient plurals.
 * @param word - The word to singularize
 * @returns Singular form of the word
 */
function singularize(word: string): string {
  // Common irregular plurals and words that shouldn't be changed
  const irregulars: Record<string, string> = {
    tomatoes: 'tomato',
    potatoes: 'potato',
    leaves: 'leaf',
    halves: 'half',
    loaves: 'loaf',
    cloves: 'clove',
    olives: 'olive',
  };

  const lower = word.toLowerCase();
  if (irregulars[lower]) return irregulars[lower];

  // Standard pluralization rules (reversed)
  if (lower.endsWith('ies') && lower.length > 4) {
    return lower.slice(0, -3) + 'y';
  }
  if (lower.endsWith('ves') && lower.length > 4) {
    // Handle -ves -> -ve (e.g., chives -> chive) but keep irregular ones in map
    return lower.slice(0, -1);
  }
  if (lower.endsWith('es') && lower.length > 3) {
    // Check for -shes, -ches, -xes, -zes, -ses
    const stem = lower.slice(0, -2);
    if (
      stem.endsWith('sh') ||
      stem.endsWith('ch') ||
      stem.endsWith('x') ||
      stem.endsWith('z') ||
      stem.endsWith('s')
    ) {
      return stem;
    }
  }
  if (lower.endsWith('s') && lower.length > 2 && !lower.endsWith('ss')) {
    return lower.slice(0, -1);
  }

  return lower;
}

/**
 * Normalizes an ingredient name for comparison.
 * Removes descriptors and preparation methods, lowercases, trims, singularizes.
 *
 * @param name - The ingredient name
 * @returns Normalized name for comparison
 */
export function normalizeIngredientName(name: string): string {
  let normalized = name
    .toLowerCase()
    .trim()
    // Remove common descriptors in parentheses
    .replace(/\([^)]*\)/g, '')
    // Remove trailing commas and prep instructions
    .replace(/,.*$/, '')
    // Remove common adjectives that don't affect identity
    .replace(
      /\b(fresh|dried|chopped|minced|diced|sliced|grated|crushed|whole|ground|large|medium|small)\b/g,
      ''
    )
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();

  // Singularize each word in the name
  normalized = normalized
    .split(' ')
    .map((word) => singularize(word))
    .join(' ');

  return normalized;
}

/**
 * Formats a numeric amount for display.
 * Converts decimals back to fractions where appropriate.
 *
 * @param amount - The numeric amount
 * @returns Formatted string
 */
export function formatAmount(amount: number | null): string {
  if (amount === null) return '';

  // Handle common fractions
  const fractions: Record<number, string> = {
    0.25: '1/4',
    0.333: '1/3',
    0.5: '1/2',
    0.666: '2/3',
    0.75: '3/4',
  };

  const whole = Math.floor(amount);
  const decimal = amount - whole;

  // Find closest fraction
  let fractionStr = '';
  for (const [val, str] of Object.entries(fractions)) {
    if (Math.abs(decimal - parseFloat(val)) < 0.01) {
      fractionStr = str;
      break;
    }
  }

  if (whole === 0 && fractionStr) {
    return fractionStr;
  }

  if (fractionStr) {
    return `${whole} ${fractionStr}`;
  }

  // Round to reasonable precision
  if (Number.isInteger(amount)) {
    return amount.toString();
  }

  return amount.toFixed(2).replace(/\.?0+$/, '');
}

/**
 * Merges duplicate ingredients from a shopping list.
 * Combines items with the same normalized name and compatible units.
 *
 * @param items - Array of shopping list items
 * @returns Array of merged ingredients
 */
export function mergeIngredients(items: ShoppingListItem[]): MergedIngredient[] {
  const merged = new Map<string, MergedIngredient>();

  for (const item of items) {
    const parsed = parseIngredient(item.raw || `${item.amount} ${item.unit} ${item.ingredient}`);
    const normalizedName = normalizeIngredientName(parsed.name || item.ingredient);
    const normalizedUnit = normalizeUnit(parsed.unit || item.unit);

    // Create a key from normalized name and unit
    const key = `${normalizedName}|${normalizedUnit}`;

    const existing = merged.get(key);
    if (existing) {
      // Add amounts if both have amounts
      if (existing.amount !== null && parsed.amount !== null) {
        existing.amount += parsed.amount;
      } else if (parsed.amount !== null) {
        existing.amount = parsed.amount;
      }
      // Track which recipes contributed
      if (!existing.recipeSlugs.includes(item.recipeSlug)) {
        existing.recipeSlugs.push(item.recipeSlug);
      }
    } else {
      merged.set(key, {
        amount: parsed.amount,
        unit: normalizedUnit,
        name: parsed.name || item.ingredient,
        recipeSlugs: [item.recipeSlug],
      });
    }
  }

  // Sort by name for consistent display
  return Array.from(merged.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );
}

/**
 * Formats a merged ingredient for display.
 *
 * @param ingredient - The merged ingredient
 * @returns Formatted string (e.g., "3 tbsp olive oil", "5 lemons")
 */
export function formatMergedIngredient(ingredient: MergedIngredient): string {
  const amountStr = formatAmount(ingredient.amount);
  const parts: string[] = [];

  if (amountStr) {
    parts.push(amountStr);
  }
  if (ingredient.unit) {
    parts.push(ingredient.unit);
  }
  parts.push(ingredient.name);

  return parts.join(' ');
}
