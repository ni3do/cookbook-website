/**
 * Comments API Endpoint
 *
 * GET /api/comments/[slug] - Fetch all comments for a recipe
 * Returns comments ordered by created_at descending (newest first)
 */

import type { APIRoute } from 'astro';
import { getDb, DatabaseError } from '../../../lib/db';

/** Comment shape returned from the API */
interface Comment {
  id: number;
  recipe_slug: string;
  author_name: string;
  content: string;
  created_at: string;
}

/**
 * GET handler - Fetch comments for a recipe
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

    const comments = db
      .prepare(
        `SELECT id, recipe_slug, author_name, content, created_at
         FROM comments
         WHERE recipe_slug = ?
         ORDER BY created_at DESC`
      )
      .all(slug) as Comment[];

    return new Response(JSON.stringify(comments), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to fetch comments:', error);

    const message =
      error instanceof DatabaseError
        ? 'Database connection error'
        : 'Failed to fetch comments';

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
