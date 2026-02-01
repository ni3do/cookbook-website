/**
 * Recipe Scraping API Endpoint
 *
 * GET /api/scrape?url=<encoded-url> - Scrape recipe data from external URL
 *
 * Extracts recipe information from external websites using Schema.org JSON-LD,
 * downloads and processes images, and returns structured data for form population.
 */

import type { APIRoute } from 'astro';
import {
  checkRateLimit,
  getClientIp,
  createRateLimitResponse,
} from '../../lib/rateLimit';
import { extractJsonLd, type ScrapedRecipe } from '../../lib/scraper';
import sharp from 'sharp';
import * as fs from 'fs';
import * as path from 'path';

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Rate limit config: 10 requests per minute */
const SCRAPE_RATE_LIMIT = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
};

/** Timeout for fetching external URLs (10 seconds) */
const FETCH_TIMEOUT_MS = 10 * 1000;

/** User-Agent header for requests */
const USER_AGENT =
  'Mozilla/5.0 (compatible; RecipeScraper/1.0; +https://github.com/kyburz-switzerland/cookbook)';

/** Maximum image size to download (10MB) */
const MAX_IMAGE_SIZE = 10 * 1024 * 1024;

/** Thumbnail width in pixels */
const THUMBNAIL_WIDTH = 400;

/** Full image max width in pixels */
const FULL_IMAGE_WIDTH = 1200;

// ─────────────────────────────────────────────────────────────────────────────
// Helper Functions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a JSON response with the given data and status code.
 */
function jsonResponse(data: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Validates that a string is a valid HTTP/HTTPS URL.
 */
function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Fetches HTML content from a URL with timeout and appropriate headers.
 *
 * @param url - URL to fetch
 * @returns HTML content as string
 * @throws Error if fetch fails, times out, or returns non-HTML content
 */
async function fetchHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    // Verify we got HTML content
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      throw new Error('Response is not HTML');
    }

    return await response.text();
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Extracts a readable source name from a URL's hostname.
 *
 * @example
 * extractSourceName('https://www.seriouseats.com/recipe') // 'Serious Eats'
 * extractSourceName('https://cooking.nytimes.com/recipe') // 'Cooking NYTimes'
 */
function extractSourceName(url: string): string {
  try {
    const hostname = new URL(url).hostname;

    // Remove www. prefix
    let name = hostname.replace(/^www\./, '');

    // Remove common TLDs
    name = name.replace(/\.(com|org|net|co\.uk|io)$/, '');

    // Split by dots and capitalize each part
    const parts = name.split('.');
    const formatted = parts
      .map((part) => {
        // Handle common abbreviations
        if (part.toLowerCase() === 'nyt' || part.toLowerCase() === 'nytimes') {
          return 'NYTimes';
        }
        if (part.toLowerCase() === 'bbc') {
          return 'BBC';
        }
        // Capitalize first letter of each word
        return part.charAt(0).toUpperCase() + part.slice(1);
      })
      .join(' ');

    return formatted;
  } catch {
    return 'Unknown Source';
  }
}

/**
 * Fetches data with retry logic (2 retries, exponential backoff).
 */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  retries = 2
): Promise<Response> {
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      // Don't retry on 4xx errors
      if (response.status >= 400 && response.status < 500) {
        throw new Error(`HTTP ${response.status}`);
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      // Don't retry on abort
      if (lastError.name === 'AbortError') {
        throw lastError;
      }
    }

    // Wait before retry (exponential backoff: 500ms, 1000ms)
    if (attempt < retries) {
      await new Promise((resolve) => setTimeout(resolve, 500 * Math.pow(2, attempt)));
    }
  }

  throw lastError || new Error('Fetch failed');
}

/**
 * Downloads and processes an image from a URL.
 * Creates both full-size (1200px) and thumbnail (400px) versions in WebP format.
 *
 * @param imageUrl - URL of the image to download
 * @returns Object with local paths for the processed images, or undefined on failure
 */
async function downloadAndProcessImage(
  imageUrl: string
): Promise<{ imagePath: string; thumbnailPath: string } | undefined> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetchWithRetry(imageUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': USER_AGENT,
      },
    });

    // Check content length if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_IMAGE_SIZE) {
      console.warn(`Image too large: ${contentLength} bytes`);
      return undefined;
    }

    // Verify it's an image
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.startsWith('image/')) {
      console.warn(`Not an image: ${contentType}`);
      return undefined;
    }

    const buffer = Buffer.from(await response.arrayBuffer());

    // Double-check size after download
    if (buffer.length > MAX_IMAGE_SIZE) {
      console.warn(`Downloaded image too large: ${buffer.length} bytes`);
      return undefined;
    }

    // Generate unique filename
    const timestamp = Date.now();
    const slug = `scrape-${timestamp}`;

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
  } catch (error) {
    console.error('Image download/processing failed:', error);
    return undefined;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// GET Handler
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET handler - Scrape recipe from URL
 *
 * Query parameters:
 * - url: The URL to scrape (required, must be HTTP/HTTPS)
 *
 * Response codes:
 * - 200: Success, recipe found
 * - 400: Invalid or missing URL
 * - 404: No recipe found on page
 * - 429: Rate limited
 * - 502: Failed to fetch URL
 */
export const GET: APIRoute = async ({ request }) => {
  // Rate limiting check
  const clientIp = getClientIp(request);
  const rateLimitResult = checkRateLimit(clientIp, SCRAPE_RATE_LIMIT);

  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult.resetMs);
  }

  // Extract URL from query parameters
  const requestUrl = new URL(request.url);
  const targetUrl = requestUrl.searchParams.get('url');

  // Validate URL presence
  if (!targetUrl) {
    return jsonResponse({ error: 'Missing url parameter' }, 400);
  }

  // Validate URL format (must be HTTP/HTTPS)
  if (!isValidUrl(targetUrl)) {
    return jsonResponse({ error: 'Invalid URL. Must be a valid HTTP or HTTPS URL.' }, 400);
  }

  // Fetch HTML from the target URL
  let html: string;
  try {
    html = await fetchHtml(targetUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';

    // Handle specific error cases
    if (message.includes('abort') || message.includes('timeout')) {
      return jsonResponse({ error: 'Request timed out. The website took too long to respond.' }, 502);
    }

    return jsonResponse({ error: `Could not fetch URL: ${message}` }, 502);
  }

  // Extract recipe data from HTML
  const recipeData = extractJsonLd(html);

  if (!recipeData) {
    return jsonResponse({ error: 'No recipe found on that page' }, 404);
  }

  // Build the complete recipe object
  const recipe: ScrapedRecipe = {
    ...recipeData,
    sourceUrl: targetUrl,
    sourceName: extractSourceName(targetUrl),
  };

  // Download and process image if available
  if (recipe.imageUrl) {
    const imageResult = await downloadAndProcessImage(recipe.imageUrl);
    if (imageResult) {
      recipe.imagePath = imageResult.imagePath;
      recipe.thumbnailPath = imageResult.thumbnailPath;
    }
    // Image download is non-blocking - recipe still imports without image
  }

  return jsonResponse(recipe as unknown as Record<string, unknown>, 200);
};
