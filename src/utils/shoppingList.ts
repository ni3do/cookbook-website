/**
 * Shopping List State Management
 *
 * Provides localStorage-backed functions for managing a shopping list
 * with ingredients from multiple recipes.
 */

const STORAGE_KEY = 'shopping-list';

/**
 * Represents a single item in the shopping list.
 */
export interface ShoppingListItem {
  /** The ingredient name (e.g., "chicken breast", "olive oil") */
  ingredient: string;
  /** The amount as a string (e.g., "2", "1/2", "400") */
  amount: string;
  /** The unit of measurement (e.g., "cups", "tbsp", "g", "") */
  unit: string;
  /** The recipe slug this ingredient came from */
  recipeSlug: string;
  /** Original raw ingredient string from the recipe */
  raw: string;
}

/**
 * The structure stored in localStorage.
 */
interface ShoppingListData {
  items: ShoppingListItem[];
  updatedAt: string;
}

/**
 * Checks if localStorage is available (client-side only).
 */
function isLocalStorageAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const test = '__storage_test__';
    localStorage.setItem(test, test);
    localStorage.removeItem(test);
    return true;
  } catch {
    return false;
  }
}

/**
 * Retrieves all items from the shopping list.
 * @returns Array of shopping list items
 */
export function getShoppingList(): ShoppingListItem[] {
  if (!isLocalStorageAvailable()) return [];

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const data: ShoppingListData = JSON.parse(stored);
    return data.items || [];
  } catch {
    return [];
  }
}

/**
 * Saves items to the shopping list in localStorage.
 */
function saveShoppingList(items: ShoppingListItem[]): void {
  if (!isLocalStorageAvailable()) return;

  const data: ShoppingListData = {
    items,
    updatedAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

/**
 * Adds ingredients from a recipe to the shopping list.
 * @param recipeSlug - The unique identifier of the recipe
 * @param ingredients - Array of ingredient objects to add
 */
export function addToShoppingList(
  recipeSlug: string,
  ingredients: Array<{
    ingredient: string;
    amount: string;
    unit: string;
    raw: string;
  }>
): void {
  const currentItems = getShoppingList();

  // Remove any existing items from this recipe first (to allow updating)
  const filteredItems = currentItems.filter(
    (item) => item.recipeSlug !== recipeSlug
  );

  // Add new items with recipe slug
  const newItems: ShoppingListItem[] = ingredients.map((ing) => ({
    ...ing,
    recipeSlug,
  }));

  saveShoppingList([...filteredItems, ...newItems]);

  // Dispatch custom event for UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('shoppinglistchange', {
        detail: { action: 'add', recipeSlug },
      })
    );
  }
}

/**
 * Removes all ingredients from a specific recipe from the shopping list.
 * @param recipeSlug - The unique identifier of the recipe to remove
 */
export function removeFromShoppingList(recipeSlug: string): void {
  const currentItems = getShoppingList();
  const filteredItems = currentItems.filter(
    (item) => item.recipeSlug !== recipeSlug
  );

  saveShoppingList(filteredItems);

  // Dispatch custom event for UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('shoppinglistchange', {
        detail: { action: 'remove', recipeSlug },
      })
    );
  }
}

/**
 * Clears all items from the shopping list.
 */
export function clearShoppingList(): void {
  if (!isLocalStorageAvailable()) return;

  localStorage.removeItem(STORAGE_KEY);

  // Dispatch custom event for UI updates
  if (typeof window !== 'undefined') {
    window.dispatchEvent(
      new CustomEvent('shoppinglistchange', {
        detail: { action: 'clear' },
      })
    );
  }
}

/**
 * Checks if a recipe is already in the shopping list.
 * @param recipeSlug - The unique identifier of the recipe
 * @returns true if the recipe has items in the shopping list
 */
export function isRecipeInShoppingList(recipeSlug: string): boolean {
  const items = getShoppingList();
  return items.some((item) => item.recipeSlug === recipeSlug);
}

/**
 * Gets the count of unique recipes in the shopping list.
 * @returns Number of unique recipes
 */
export function getShoppingListRecipeCount(): number {
  const items = getShoppingList();
  const uniqueSlugs = new Set(items.map((item) => item.recipeSlug));
  return uniqueSlugs.size;
}

/**
 * Gets the total count of items in the shopping list.
 * @returns Number of items
 */
export function getShoppingListItemCount(): number {
  return getShoppingList().length;
}

/**
 * Gets all unique recipe slugs in the shopping list.
 * @returns Array of recipe slugs
 */
export function getShoppingListRecipeSlugs(): string[] {
  const items = getShoppingList();
  return [...new Set(items.map((item) => item.recipeSlug))];
}
