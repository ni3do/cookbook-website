#!/usr/bin/env node
/**
 * Transforms Obsidian cookbook recipes to Astro content format.
 * Run with: node scripts/import-obsidian-recipes.mjs
 */

import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, basename } from 'path';

const OBSIDIAN_DIR = '../obsidian-cookbook/content';
const OUTPUT_DIR = 'src/content/recipes';

// Valid tags from config.ts
const VALID_TAGS = [
  'italian', 'asian', 'mexican', 'mediterranean', 'american', 'french', 'indian', 'middle-eastern',
  'breakfast', 'lunch', 'dinner', 'snack', 'dessert', 'appetizer',
  'vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'keto', 'low-carb',
  'quick', 'weeknight', 'meal-prep', 'slow-cooker',
  'comfort-food', 'healthy', 'one-pot', 'grilling', 'salad', 'soup', 'stew',
  'chicken', 'beef', 'pork', 'fish', 'seafood', 'tofu', 'eggs',
  'bread', 'cookies', 'cakes', 'pies', 'pastry', 'muffins', 'brownies', 'tarts', 'sourdough', 'no-knead', 'yeast-baking', 'quick-bread',
  'summer', 'fall', 'winter', 'spring', 'holiday',
];

// Map Obsidian tags to valid tags
const TAG_MAP = {
  'pasta': 'italian',
  'pizza': 'italian',
  'baked': 'dessert',
  'desserts': 'dessert',
  'main-dishes': 'dinner',
  'sauce': 'dinner',
  'sides': 'dinner',
  'asian-food': 'asian',
};

function extractDomainName(url) {
  if (!url) return null;
  try {
    const hostname = new URL(url).hostname;
    // Remove www. and extract site name
    const name = hostname.replace(/^www\./, '').split('.')[0];
    return name.charAt(0).toUpperCase() + name.slice(1);
  } catch {
    return 'Recipe Source';
  }
}

function mapTags(obsidianTags) {
  if (!obsidianTags || !Array.isArray(obsidianTags)) return [];

  const mapped = new Set();
  for (const tag of obsidianTags) {
    const normalizedTag = tag.toLowerCase();
    if (VALID_TAGS.includes(normalizedTag)) {
      mapped.add(normalizedTag);
    } else if (TAG_MAP[normalizedTag]) {
      mapped.add(TAG_MAP[normalizedTag]);
    }
  }
  return Array.from(mapped);
}

function extractImageFromContent(content) {
  // Match ![[image.png]] or ![[path/image.png]]
  const match = content.match(/!\[\[(?:.*\/)?([^\]]+)\]\]/);
  return match ? match[1] : null;
}

function transformContent(content) {
  let transformed = content;

  // Remove Obsidian image embeds
  transformed = transformed.replace(/!\[\[[^\]]+\]\]/g, '');

  // Remove blockquotes (description lines)
  transformed = transformed.replace(/^>.*$/gm, '');

  // Transform headers: # → ##
  transformed = transformed.replace(/^# /gm, '## ');

  // Transform "Instructions" to "Steps"
  transformed = transformed.replace(/## Instructions/g, '## Steps');

  // Remove checkboxes and wrap amounts in backticks
  transformed = transformed.replace(/^- \[ \] (\d+[\d\/\.,]*\s*(?:g|kg|ml|l|tsp|tbsp|cup|cups|oz|lb|pinch|bunch)?)\s+/gm, (_, amount) => {
    return `- \`${amount.trim()}\` `;
  });

  // Handle remaining checkboxes without clear amounts
  transformed = transformed.replace(/^- \[ \] /gm, '- ');

  // Clean up extra blank lines
  transformed = transformed.replace(/\n{3,}/g, '\n\n');

  return transformed.trim();
}

function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { frontmatter: {}, body: content };

  const frontmatterStr = match[1];
  const body = content.slice(match[0].length).trim();

  // Simple YAML parsing
  const frontmatter = {};
  let currentKey = null;
  let currentArray = null;

  for (const line of frontmatterStr.split('\n')) {
    const arrayMatch = line.match(/^\s+-\s+(.+)/);
    if (arrayMatch && currentKey) {
      if (!currentArray) currentArray = [];
      currentArray.push(arrayMatch[1].trim());
      frontmatter[currentKey] = currentArray;
      continue;
    }

    if (currentArray) {
      currentArray = null;
    }

    const keyMatch = line.match(/^(\w[\w-]*):(.*)$/);
    if (keyMatch) {
      currentKey = keyMatch[1];
      const value = keyMatch[2].trim();
      if (value) {
        // Remove quotes
        frontmatter[currentKey] = value.replace(/^["']|["']$/g, '');
      }
    }
  }

  return { frontmatter, body };
}

function transformRecipe(filename, content) {
  const { frontmatter, body } = parseFrontmatter(content);

  // Skip index.md
  if (filename === 'index.md') return null;

  const slug = basename(filename, '.md');
  const image = extractImageFromContent(body) || `${slug}.jpg`;

  // Build new frontmatter
  const newFrontmatter = {
    title: frontmatter.title || slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    image: image,
    author: 'Simon',
    prep_time: parseInt(frontmatter['prep-time']) || 15,
    cook_time: parseInt(frontmatter['cook-time']) || 30,
    servings: parseInt(frontmatter.servings) || 4,
    tags: mapTags(frontmatter.tags),
  };

  // Add source if present
  if (frontmatter.source) {
    newFrontmatter.source = {
      name: extractDomainName(frontmatter.source),
      url: frontmatter.source,
    };
  }

  // Transform content
  const newBody = transformContent(body);

  // Build output
  let output = '---\n';
  output += `title: '${newFrontmatter.title}'\n`;
  output += `image: '${newFrontmatter.image}'\n`;
  output += `author: '${newFrontmatter.author}'\n`;
  output += `prep_time: ${newFrontmatter.prep_time}\n`;
  output += `cook_time: ${newFrontmatter.cook_time}\n`;
  output += `servings: ${newFrontmatter.servings}\n`;
  output += `tags: [${newFrontmatter.tags.join(', ')}]\n`;

  if (newFrontmatter.source) {
    output += `source:\n`;
    output += `  name: '${newFrontmatter.source.name}'\n`;
    output += `  url: '${newFrontmatter.source.url}'\n`;
  }

  output += '---\n\n';
  output += newBody;
  output += '\n';

  return output;
}

// Main
const files = readdirSync(OBSIDIAN_DIR).filter(f => f.endsWith('.md') && f !== 'index.md');

console.log(`Found ${files.length} recipes to import:\n`);

for (const file of files) {
  const inputPath = join(OBSIDIAN_DIR, file);
  const outputPath = join(OUTPUT_DIR, file);

  const content = readFileSync(inputPath, 'utf-8');
  const transformed = transformRecipe(file, content);

  if (transformed) {
    writeFileSync(outputPath, transformed);
    console.log(`✓ ${file}`);
  }
}

console.log(`\nImported ${files.length} recipes to ${OUTPUT_DIR}`);
