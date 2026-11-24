/**
 * Pure helpers for the homepage recipe filter (search + multi-tag + author).
 * Kept framework-free so they can run in the browser and be unit-tested in Node.
 */

export interface FilterableRecipe {
  title: string;
  ingredients: string;
  tags: string[];
  author: string;
}

export interface FilterState {
  query: string;
  tags: string[];
  author: string | null;
}

/** A recipe matches when it satisfies the search AND has ALL selected tags AND the author. */
export function matchesFilter(
  recipe: FilterableRecipe,
  state: FilterState
): boolean {
  const query = state.query.trim().toLowerCase();
  const matchesSearch =
    query === '' ||
    recipe.title.toLowerCase().includes(query) ||
    recipe.ingredients.toLowerCase().includes(query);
  const matchesTags = state.tags.every((tag) => recipe.tags.includes(tag));
  const matchesAuthor =
    !state.author || recipe.author.toLowerCase() === state.author.toLowerCase();
  return matchesSearch && matchesTags && matchesAuthor;
}

/** Parse `?tags=a,b&author=X&q=...` into a filter state. */
export function parseFilterParams(search: string): FilterState {
  const params = new URLSearchParams(search);
  const tags = (params.get('tags') || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  return {
    query: params.get('q') || '',
    tags: [...new Set(tags)],
    author: params.get('author') || null,
  };
}

/** Serialize a filter state to a query string ('' when no filters are active). */
export function serializeFilterParams(state: FilterState): string {
  const params = new URLSearchParams();
  if (state.query.trim()) params.set('q', state.query.trim());
  if (state.tags.length > 0) params.set('tags', state.tags.join(','));
  if (state.author) params.set('author', state.author);
  // Keep commas readable in shared links
  const str = params.toString().replace(/%2C/gi, ',');
  return str ? `?${str}` : '';
}
