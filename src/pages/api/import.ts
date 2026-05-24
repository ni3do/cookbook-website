/**
 * Recipe Import API — two-stage flow backed by the claude-runner sidecar.
 *
 *   POST /api/import?stage=preview
 *     body: JSON { url, website? }
 *     response: structured recipe JSON (Claude's extraction)
 *
 *   POST /api/import?stage=submit
 *     body: multipart form-data with `recipe` (JSON string), `author_name`,
 *           `captcha`, `captcha_answer`, optional `image` (file)
 *     response: { prUrl, slug }
 *
 * Uploaded images go to UPLOAD_DIR (a volume shared with the sidecar) and
 * are passed by file path. URL-imported images stay as URLs the sidecar
 * curls directly. No HTTP roundtrip for uploads — the sidecar reads the
 * file from the shared volume.
 */

import type { APIRoute } from 'astro';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from '../../lib/rateLimit';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

// ─── config ──────────────────────────────────────────────────────────────────

const RATE_LIMIT_PREVIEW = { maxRequests: 10, windowMs: 10 * 60 * 1000 };
const RATE_LIMIT_SUBMIT = { maxRequests: 5, windowMs: 10 * 60 * 1000 };

const SIDECAR_URL =
  import.meta.env.CLAUDE_RUNNER_URL || 'http://claude-runner:8080';
const UPLOAD_DIR = import.meta.env.UPLOAD_DIR || '/uploads';

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const FULL_IMAGE_WIDTH = 1200;

// ─── helpers ─────────────────────────────────────────────────────────────────

function jsonResponse(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

interface CaptchaInput {
  captcha?: string | null;
  captcha_answer?: string | null;
  website?: string | null;
}

/**
 * Returns null if validation passes, or a Response if it fails. Honeypot hits
 * return a fake-success Response so spam bots don't learn from the rejection.
 */
function checkAntiSpam(input: CaptchaInput): Response | null {
  if (input.website && input.website.trim() !== '') {
    return jsonResponse({ message: 'Recipe submitted successfully' }, 200);
  }
  if (
    !input.captcha ||
    !input.captcha_answer ||
    input.captcha !== input.captcha_answer
  ) {
    return jsonResponse({ errors: ['Incorrect answer to math question'] }, 400);
  }
  return null;
}

async function callSidecar(
  endpoint: '/extract' | '/publish',
  body: Record<string, unknown>,
  timeoutMs: number
): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(`${SIDECAR_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    let data: Record<string, unknown>;
    try {
      data = await r.json();
    } catch {
      data = { error: `sidecar returned non-JSON (status ${r.status})` };
    }
    return { ok: r.ok, status: r.status, data };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Resize + transcode an upload to webp, write it to the shared upload
 * volume, and return the absolute path the sidecar can read.
 */
async function processImageUpload(file: File): Promise<string> {
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Image must be JPG, PNG, or WebP format');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('Image must be less than 5MB');
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  const filename = `submission-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.webp`;
  const fullPath = path.join(UPLOAD_DIR, filename);
  await sharp(buffer)
    .resize(FULL_IMAGE_WIDTH, null, { withoutEnlargement: true, fit: 'inside' })
    .webp({ quality: 85 })
    .toFile(fullPath);
  return fullPath;
}

function isValidUrl(s: unknown): s is string {
  if (typeof s !== 'string') return false;
  try {
    const u = new URL(s);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

// ─── handler ─────────────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request, url }) => {
  const stage = url.searchParams.get('stage');
  if (stage !== 'preview' && stage !== 'submit') {
    return jsonResponse(
      { error: "stage query parameter must be 'preview' or 'submit'" },
      400
    );
  }

  const ip = getClientIp(request);
  const rl = checkRateLimit(
    ip,
    stage === 'preview' ? RATE_LIMIT_PREVIEW : RATE_LIMIT_SUBMIT
  );
  if (!rl.allowed) return createRateLimitResponse(rl.resetMs);

  // ─── stage: preview ────────────────────────────────────────────────────────
  // Preview is captcha-less by design (the form's CAPTCHA lives at the bottom
  // of the page and is only solved before submit). Honeypot + rate limit are
  // the only guards here.
  if (stage === 'preview') {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'expected JSON body' }, 400);
    }

    const honeypot = body.website;
    if (typeof honeypot === 'string' && honeypot.trim() !== '') {
      return jsonResponse({ message: 'ok' }, 200);
    }

    const importUrl = typeof body.url === 'string' ? body.url.trim() : '';
    if (!importUrl) {
      return jsonResponse({ errors: ['URL is required'] }, 400);
    }
    if (!isValidUrl(importUrl)) {
      return jsonResponse({ errors: ['URL is not valid'] }, 400);
    }

    const result = await callSidecar(
      '/extract',
      { url: importUrl },
      150_000
    ).catch((err) => ({
      ok: false,
      status: 504,
      data: { error: (err as Error).message },
    }));

    if (!result.ok) {
      return jsonResponse(
        {
          error: 'Failed to import recipe',
          detail: result.data.error,
        },
        result.status === 422 ? 422 : 502
      );
    }
    return jsonResponse(result.data, 200);
  }

  // ─── stage: submit ─────────────────────────────────────────────────────────
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return jsonResponse({ error: 'expected multipart form data' }, 400);
  }

  const spamResult = checkAntiSpam({
    captcha: form.get('captcha') as string | null,
    captcha_answer: form.get('captcha_answer') as string | null,
    website: form.get('website') as string | null,
  });
  if (spamResult) return spamResult;

  const authorName = (form.get('author_name') as string | null)?.trim();
  if (!authorName) {
    return jsonResponse({ errors: ['Your name is required'] }, 400);
  }

  const recipeRaw = form.get('recipe');
  if (typeof recipeRaw !== 'string' || !recipeRaw.trim()) {
    return jsonResponse({ errors: ['Recipe data is required'] }, 400);
  }
  let recipe: Record<string, unknown>;
  try {
    recipe = JSON.parse(recipeRaw);
  } catch {
    return jsonResponse({ errors: ['Recipe data is not valid JSON'] }, 400);
  }

  const errors: string[] = [];
  if (typeof recipe.title !== 'string' || !recipe.title.trim())
    errors.push('Recipe title is required');
  if (typeof recipe.description !== 'string' || !recipe.description.trim())
    errors.push('Description is required');
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0)
    errors.push('At least one ingredient is required');
  if (!Array.isArray(recipe.steps) || recipe.steps.length === 0)
    errors.push('At least one instruction step is required');
  if (errors.length > 0) {
    return jsonResponse({ errors }, 400);
  }

  // Resolve the image source: a user upload becomes a path on the shared
  // /uploads volume; otherwise we fall through to the URL the preview stage
  // returned from the original page.
  let imagePayload: { image_path?: string; image_url?: string } = {};
  const imageFile = form.get('image') as File | null;
  if (imageFile && imageFile.size > 0) {
    try {
      const fullPath = await processImageUpload(imageFile);
      imagePayload = { image_path: fullPath };
    } catch (e) {
      return jsonResponse({ errors: [(e as Error).message] }, 400);
    }
  } else {
    const explicitUrl = (form.get('image_url') as string | null)?.trim();
    const recipeImageUrl =
      typeof recipe.image_url === 'string' ? recipe.image_url.trim() : '';
    const imageUrl = explicitUrl || recipeImageUrl;
    if (imageUrl && isValidUrl(imageUrl)) {
      imagePayload = { image_url: imageUrl };
    }
  }
  if (!imagePayload.image_path && !imagePayload.image_url) {
    return jsonResponse(
      { errors: ['A recipe photo (upload or URL) is required'] },
      400
    );
  }

  const result = await callSidecar(
    '/publish',
    { recipe, ...imagePayload, author_name: authorName },
    320_000
  ).catch((err) => ({
    ok: false,
    status: 504,
    data: { error: (err as Error).message },
  }));

  if (!result.ok) {
    return jsonResponse(
      { error: 'Failed to publish recipe', detail: result.data.error },
      result.status === 422 ? 422 : 502
    );
  }

  return jsonResponse(
    {
      message: 'Recipe submitted successfully! A pull request has been opened.',
      prUrl: result.data.prUrl,
      slug: result.data.slug,
    },
    200
  );
};
