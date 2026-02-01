/**
 * Rating utility functions for server-side access.
 *
 * These functions are used at build time or during SSR to fetch
 * rating data for SEO schema generation.
 */

import { getDb, DatabaseError } from './db';

/** Rating statistics for a recipe */
export interface RatingStats {
  averageRating: number | null;
  ratingCount: number;
}

/** Row shape from the aggregate query */
interface RatingAggregateRow {
  average_rating: number | null;
  rating_count: number;
}

/**
 * Fetch rating statistics for a single recipe.
 *
 * @param slug - The recipe slug
 * @returns Rating statistics or null if an error occurs
 */
export function getRatingStats(slug: string): RatingStats | null {
  try {
    const db = getDb();

    const result = db
      .prepare(
        `SELECT
           ROUND(AVG(rating), 1) as average_rating,
           COUNT(*) as rating_count
         FROM ratings
         WHERE recipe_slug = ?`
      )
      .get(slug) as RatingAggregateRow | undefined;

    if (!result) {
      return { averageRating: null, ratingCount: 0 };
    }

    return {
      averageRating: result.rating_count > 0 ? result.average_rating : null,
      ratingCount: result.rating_count,
    };
  } catch (error) {
    if (error instanceof DatabaseError) {
      console.error('Database error fetching ratings:', error.message);
    } else {
      console.error('Failed to fetch ratings:', error);
    }
    return null;
  }
}

/**
 * Fetch rating statistics for multiple recipes at once.
 * More efficient than calling getRatingStats for each recipe.
 *
 * @param slugs - Array of recipe slugs
 * @returns Map of slug to rating stats
 */
export function getBulkRatingStats(slugs: string[]): Map<string, RatingStats> {
  const result = new Map<string, RatingStats>();

  if (slugs.length === 0) {
    return result;
  }

  try {
    const db = getDb();

    // Initialize all slugs with zero ratings
    for (const slug of slugs) {
      result.set(slug, { averageRating: null, ratingCount: 0 });
    }

    // Build parameterized query for multiple slugs
    const placeholders = slugs.map(() => '?').join(',');
    const rows = db
      .prepare(
        `SELECT
           recipe_slug,
           ROUND(AVG(rating), 1) as average_rating,
           COUNT(*) as rating_count
         FROM ratings
         WHERE recipe_slug IN (${placeholders})
         GROUP BY recipe_slug`
      )
      .all(...slugs) as Array<{
      recipe_slug: string;
      average_rating: number | null;
      rating_count: number;
    }>;

    // Update map with actual values
    for (const row of rows) {
      result.set(row.recipe_slug, {
        averageRating: row.rating_count > 0 ? row.average_rating : null,
        ratingCount: row.rating_count,
      });
    }

    return result;
  } catch (error) {
    if (error instanceof DatabaseError) {
      console.error('Database error fetching bulk ratings:', error.message);
    } else {
      console.error('Failed to fetch bulk ratings:', error);
    }
    return result;
  }
}
