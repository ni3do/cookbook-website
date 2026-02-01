/**
 * Ratings API Endpoint
 *
 * GET /api/ratings/[slug] - Fetch average rating and count for a recipe
 * POST /api/ratings/[slug] - Submit a new rating for a recipe
 *
 * Returns the average rating rounded to 1 decimal place and total count.
 */

import type { APIRoute } from 'astro';
import { getDb, DatabaseError } from '../../../lib/db';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from '../../../lib/rateLimit';

/** Maximum allowed author name length */
const MAX_AUTHOR_LENGTH = 100;

/** Rating statistics returned from the GET endpoint */
interface RatingStats {
  averageRating: number | null;
  ratingCount: number;
}

/** Row shape from the aggregate query */
interface RatingAggregateRow {
  average_rating: number | null;
  rating_count: number;
}

/**
 * GET handler - Fetch rating statistics for a recipe
 *
 * Returns:
 * - averageRating: number (1 decimal place) or null if no ratings
 * - ratingCount: number of ratings submitted
 */
export const GET: APIRoute = async ({ params }) => {
  const { slug } = params;

  if (!slug) {
    return new Response(JSON.stringify({ error: 'Recipe slug is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

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
      .get(slug) as RatingAggregateRow;

    // When there are no ratings, COUNT returns 0 but AVG returns null
    const stats: RatingStats = {
      averageRating: result.rating_count > 0 ? result.average_rating : null,
      ratingCount: result.rating_count,
    };

    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch ratings:', error);

    const message =
      error instanceof DatabaseError
        ? 'Database connection error'
        : 'Failed to fetch ratings';

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

/** Request body for creating a rating */
interface CreateRatingRequest {
  author_name: string;
  rating: number;
  honeypot?: string; // Should be empty - filled by bots
}

/**
 * POST handler - Submit a new rating for a recipe
 *
 * Expects JSON body with:
 * - author_name: string (required)
 * - rating: number 1-5 (required)
 * - honeypot: string (optional, should be empty)
 *
 * Returns the updated average rating and count after submission.
 */
export const POST: APIRoute = async ({ params, request }) => {
  const { slug } = params;

  if (!slug) {
    return new Response(JSON.stringify({ error: 'Recipe slug is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Rate limiting check
  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(clientIp);

  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult.resetMs);
  }

  let body: CreateRatingRequest;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Honeypot check - if filled, it's likely a bot
  if (body.honeypot && body.honeypot.trim() !== '') {
    // Return success to not reveal the spam detection
    return new Response(
      JSON.stringify({ averageRating: 0, ratingCount: 0, message: 'Rating received' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }

  // Validate required fields
  const errors: string[] = [];

  if (!body.author_name || typeof body.author_name !== 'string') {
    errors.push('author_name is required');
  } else if (body.author_name.trim().length === 0) {
    errors.push('author_name cannot be empty');
  } else if (body.author_name.length > MAX_AUTHOR_LENGTH) {
    errors.push(`author_name must be ${MAX_AUTHOR_LENGTH} characters or less`);
  }

  if (body.rating === undefined || body.rating === null) {
    errors.push('rating is required');
  } else if (typeof body.rating !== 'number' || !Number.isInteger(body.rating)) {
    errors.push('rating must be an integer');
  } else if (body.rating < 1 || body.rating > 5) {
    errors.push('rating must be between 1 and 5');
  }

  if (errors.length > 0) {
    return new Response(JSON.stringify({ errors }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Sanitize inputs
  const authorName = body.author_name.trim();
  const rating = body.rating;

  try {
    const db = getDb();

    // Insert the new rating
    db.prepare(
      `INSERT INTO ratings (recipe_slug, author_name, rating)
       VALUES (?, ?, ?)`
    ).run(slug, authorName, rating);

    // Fetch updated aggregate stats
    const result = db
      .prepare(
        `SELECT
           ROUND(AVG(rating), 1) as average_rating,
           COUNT(*) as rating_count
         FROM ratings
         WHERE recipe_slug = ?`
      )
      .get(slug) as RatingAggregateRow;

    const stats: RatingStats = {
      averageRating: result.average_rating,
      ratingCount: result.rating_count,
    };

    return new Response(JSON.stringify(stats), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to create rating:', error);

    const message =
      error instanceof DatabaseError
        ? 'Database connection error'
        : 'Failed to create rating';

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
