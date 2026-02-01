/**
 * Comments API Endpoint
 *
 * GET /api/comments/[slug] - Fetch all comments for a recipe
 * POST /api/comments/[slug] - Create a new comment for a recipe
 *
 * Returns comments ordered by created_at descending (newest first)
 */

import type { APIRoute } from 'astro';
import { getDb, DatabaseError } from '../../../lib/db';

/** Maximum allowed content length for comments */
const MAX_CONTENT_LENGTH = 5000;
/** Maximum allowed author name length */
const MAX_AUTHOR_LENGTH = 100;

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

/** Request body for creating a comment */
interface CreateCommentRequest {
  author_name: string;
  content: string;
  honeypot?: string; // Should be empty - filled by bots
}

/**
 * POST handler - Create a new comment for a recipe
 *
 * Expects JSON body with:
 * - author_name: string (required)
 * - content: string (required)
 * - honeypot: string (optional, should be empty)
 */
export const POST: APIRoute = async ({ params, request }) => {
  const { slug } = params;

  if (!slug) {
    return new Response(JSON.stringify({ error: 'Recipe slug is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  let body: CreateCommentRequest;
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
    return new Response(JSON.stringify({ id: 0, message: 'Comment received' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
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

  if (!body.content || typeof body.content !== 'string') {
    errors.push('content is required');
  } else if (body.content.trim().length === 0) {
    errors.push('content cannot be empty');
  } else if (body.content.length > MAX_CONTENT_LENGTH) {
    errors.push(`content must be ${MAX_CONTENT_LENGTH} characters or less`);
  }

  if (errors.length > 0) {
    return new Response(JSON.stringify({ errors }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Sanitize inputs (trim whitespace)
  const authorName = body.author_name.trim();
  const content = body.content.trim();

  try {
    const db = getDb();

    const result = db
      .prepare(
        `INSERT INTO comments (recipe_slug, author_name, content)
         VALUES (?, ?, ?)
         RETURNING id, recipe_slug, author_name, content, created_at`
      )
      .get(slug, authorName, content) as Comment;

    return new Response(JSON.stringify(result), {
      status: 201,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Failed to create comment:', error);

    const message =
      error instanceof DatabaseError
        ? 'Database connection error'
        : 'Failed to create comment';

    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
