/**
 * Recipe Submission API Endpoint
 *
 * POST /api/submit - Submit a new recipe for review
 *
 * Handles multipart form data including:
 * - Basic recipe info (title, description, times, servings)
 * - Recipe photo upload with processing
 * - Ingredients and steps
 * - Tags and source attribution
 * - Anti-spam validation (honeypot + CAPTCHA)
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

/** Rate limit config: stricter for submissions (5 per 10 minutes) */
const SUBMIT_RATE_LIMIT = {
  maxRequests: 5,
  windowMs: 10 * 60 * 1000,
};

/** Maximum file size in bytes (5MB) */
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/** Allowed image MIME types */
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Thumbnail width in pixels */
const THUMBNAIL_WIDTH = 400;

/** Full image max width in pixels */
const FULL_IMAGE_WIDTH = 1200;

interface SubmissionData {
  authorName: string;
  title: string;
  description: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  tags: string[];
  sourceName?: string;
  sourceUrl?: string;
  ingredients: Array<{ amount: string; name: string }>;
  steps: string[];
  notes?: string;
  imagePath?: string;
  thumbnailPath?: string;
}

/**
 * POST handler - Submit a new recipe
 */
export const POST: APIRoute = async ({ request }) => {
  // Rate limiting check
  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(clientIp, SUBMIT_RATE_LIMIT);

  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult.resetMs);
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return jsonResponse({ error: 'Invalid form data' }, 400);
  }

  // Honeypot check
  const honeypot = formData.get('website') as string | null;
  if (honeypot && honeypot.trim() !== '') {
    // Return success to not reveal spam detection
    return jsonResponse({ message: 'Recipe submitted successfully' }, 200);
  }

  // CAPTCHA validation
  const captchaAnswer = formData.get('captcha_answer') as string | null;
  const userCaptcha = formData.get('captcha') as string | null;

  if (!captchaAnswer || !userCaptcha || captchaAnswer !== userCaptcha) {
    return jsonResponse({ errors: ['Incorrect answer to math question'] }, 400);
  }

  // Validate and extract fields
  const errors: string[] = [];

  // Required fields
  const authorName = getString(formData, 'author_name');
  const title = getString(formData, 'title');
  const description = getString(formData, 'description');

  if (!authorName) errors.push('Your name is required');
  if (!title) errors.push('Recipe title is required');
  if (!description) errors.push('Description is required');

  // Optional numeric fields
  const prepTime = getNumber(formData, 'prep_time');
  const cookTime = getNumber(formData, 'cook_time');
  const servings = getNumber(formData, 'servings');

  // Tags
  const tagsRaw = getString(formData, 'tags');
  const tags = tagsRaw
    ? tagsRaw
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
    : [];

  // Source attribution
  const sourceName = getString(formData, 'source_name');
  const sourceUrl = getString(formData, 'source_url');

  // Validate source URL if provided
  if (sourceUrl && !isValidUrl(sourceUrl)) {
    errors.push('Source URL is not a valid URL');
  }

  // Notes
  const notes = getString(formData, 'notes');

  // Extract ingredients
  const ingredients: Array<{ amount: string; name: string }> = [];
  let ingredientIndex = 0;
  while (true) {
    const amount = getString(formData, `ingredient_amount_${ingredientIndex}`);
    const name = getString(formData, `ingredient_name_${ingredientIndex}`);

    if (!amount && !name) break;

    if (name) {
      ingredients.push({ amount: amount || '', name });
    }
    ingredientIndex++;
  }

  if (ingredients.length === 0) {
    errors.push('At least one ingredient is required');
  }

  // Extract steps
  const steps: string[] = [];
  let stepIndex = 1;
  while (true) {
    const step = getString(formData, `step_${stepIndex}`);
    if (!step) break;
    steps.push(step);
    stepIndex++;
  }

  if (steps.length === 0) {
    errors.push('At least one instruction step is required');
  }

  // Return validation errors if any
  if (errors.length > 0) {
    return jsonResponse({ errors }, 400);
  }

  // Process image if provided
  let imagePath: string | undefined;
  let thumbnailPath: string | undefined;

  // Check for scraped image path first (from URL import)
  const scrapedImagePath = getString(formData, 'scraped_image_path');

  if (scrapedImagePath) {
    // Validate the scraped image path exists and is in allowed directory
    const validatedPaths = validateScrapedImagePath(scrapedImagePath);
    if (validatedPaths) {
      imagePath = validatedPaths.imagePath;
      thumbnailPath = validatedPaths.thumbnailPath;
    }
    // If validation fails, we'll fall through to normal image processing below
  }

  // Only process uploaded image if we don't already have a valid scraped image
  if (!imagePath) {
    const imageFile = formData.get('image') as File | null;

    if (imageFile && imageFile.size > 0) {
      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(imageFile.type)) {
        return jsonResponse(
          { errors: ['Image must be JPG, PNG, or WebP format'] },
          400
        );
      }

      // Validate file size
      if (imageFile.size > MAX_FILE_SIZE) {
        return jsonResponse({ errors: ['Image must be less than 5MB'] }, 400);
      }

      try {
        const imageResult = await processImage(imageFile);
        imagePath = imageResult.imagePath;
        thumbnailPath = imageResult.thumbnailPath;
      } catch (error) {
        console.error('Image processing error:', error);
        return jsonResponse({ errors: ['Failed to process image'] }, 500);
      }
    }
  }

  // Prepare submission data
  const submission: SubmissionData = {
    authorName: authorName!,
    title: title!,
    description: description!,
    prepTime,
    cookTime,
    servings,
    tags,
    sourceName,
    sourceUrl,
    ingredients,
    steps,
    notes,
    imagePath,
    thumbnailPath,
  };

  // Send to webhook
  const webhookUrl = import.meta.env.RECIPE_WEBHOOK_URL;
  if (webhookUrl) {
    try {
      const webhookResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submission),
      });

      if (!webhookResponse.ok) {
        console.error(
          'Webhook error:',
          webhookResponse.status,
          await webhookResponse.text()
        );
        // Don't fail the request if webhook fails - just log it
      }
    } catch (error) {
      console.error('Webhook request failed:', error);
      // Don't fail the request if webhook fails
    }
  }

  return jsonResponse(
    {
      message: 'Recipe submitted successfully! We will review it shortly.',
      submission: {
        title: submission.title,
        authorName: submission.authorName,
        ingredientCount: submission.ingredients.length,
        stepCount: submission.steps.length,
        hasImage: !!imagePath,
      },
    },
    200
  );
};

/**
 * Process uploaded image: resize and create thumbnail
 */
async function processImage(
  file: File
): Promise<{ imagePath: string; thumbnailPath: string }> {
  const buffer = Buffer.from(await file.arrayBuffer());
  const timestamp = Date.now();
  const slug = `submission-${timestamp}`;

  // Determine output directory
  const outputDir = path.join(process.cwd(), 'public', 'images', 'submissions');

  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const imageName = `${slug}.webp`;
  const thumbnailName = `${slug}-thumb.webp`;
  const fullImagePath = path.join(outputDir, imageName);
  const fullThumbPath = path.join(outputDir, thumbnailName);

  // Process and save full-size image (max 1200px wide)
  await sharp(buffer)
    .resize(FULL_IMAGE_WIDTH, null, {
      withoutEnlargement: true,
      fit: 'inside',
    })
    .webp({ quality: 85 })
    .toFile(fullImagePath);

  // Generate thumbnail (400px wide)
  await sharp(buffer)
    .resize(THUMBNAIL_WIDTH, null, {
      withoutEnlargement: true,
      fit: 'inside',
    })
    .webp({ quality: 80 })
    .toFile(fullThumbPath);

  // Return paths relative to public directory
  return {
    imagePath: `/images/submissions/${imageName}`,
    thumbnailPath: `/images/submissions/${thumbnailName}`,
  };
}

/**
 * Validates a scraped image path and returns the paths if valid.
 * Ensures the path is in the allowed submissions directory and exists on disk.
 */
function validateScrapedImagePath(
  imagePath: string
): { imagePath: string; thumbnailPath: string } | null {
  // Only allow paths from the submissions directory (scraped images use scrape- prefix)
  const allowedPrefix = '/images/submissions/';
  if (!imagePath.startsWith(allowedPrefix)) {
    return null;
  }

  // Only allow scraped images (must have scrape- prefix in filename)
  const filename = path.basename(imagePath);
  if (!filename.startsWith('scrape-')) {
    return null;
  }

  // Validate path doesn't contain directory traversal attempts
  if (imagePath.includes('..') || imagePath.includes('//')) {
    return null;
  }

  // Construct the full file path
  const fullPath = path.join(process.cwd(), 'public', imagePath);

  // Check if the file exists
  if (!fs.existsSync(fullPath)) {
    return null;
  }

  // Derive thumbnail path (same name with -thumb suffix before extension)
  const ext = path.extname(imagePath);
  const baseName = imagePath.slice(0, -ext.length);
  const thumbnailPath = `${baseName}-thumb${ext}`;

  // Check if thumbnail exists
  const fullThumbPath = path.join(process.cwd(), 'public', thumbnailPath);
  if (!fs.existsSync(fullThumbPath)) {
    return null;
  }

  return { imagePath, thumbnailPath };
}

/**
 * Helper to extract a string from form data
 */
function getString(formData: FormData, key: string): string | undefined {
  const value = formData.get(key);
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  return undefined;
}

/**
 * Helper to extract a number from form data
 */
function getNumber(formData: FormData, key: string): number | undefined {
  const value = formData.get(key);
  if (typeof value === 'string' && value.trim()) {
    const num = parseInt(value, 10);
    if (!isNaN(num) && num >= 0) {
      return num;
    }
  }
  return undefined;
}

/**
 * Helper to validate a URL
 */
function isValidUrl(str: string): boolean {
  try {
    new URL(str);
    return true;
  } catch {
    return false;
  }
}

/**
 * Helper to create JSON responses
 */
function jsonResponse(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
