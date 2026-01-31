import { defineCollection, z } from 'astro:content';

/**
 * Valid tags for recipes, organized by category.
 * Users must select from this fixed list to ensure consistency.
 */
export const RECIPE_TAGS = [
  // Cuisine
  'italian',
  'asian',
  'mexican',
  'mediterranean',
  'american',
  'french',
  'indian',
  'middle-eastern',
  // Meal
  'breakfast',
  'lunch',
  'dinner',
  'snack',
  'dessert',
  'appetizer',
  // Diet
  'vegetarian',
  'vegan',
  'gluten-free',
  'dairy-free',
  'keto',
  'low-carb',
  // Speed
  'quick',
  'weeknight',
  'meal-prep',
  'slow-cooker',
  // Style
  'comfort-food',
  'healthy',
  'one-pot',
  'grilling',
  'salad',
  'soup',
  'stew',
  // Protein
  'chicken',
  'beef',
  'pork',
  'fish',
  'seafood',
  'tofu',
  'eggs',
  // Baking
  'bread',
  'cookies',
  'cakes',
  'pies',
  'pastry',
  'muffins',
  'brownies',
  'tarts',
  'sourdough',
  'no-knead',
  'yeast-baking',
  'quick-bread',
  // Season
  'summer',
  'fall',
  'winter',
  'spring',
  'holiday',
] as const;

export type RecipeTag = (typeof RECIPE_TAGS)[number];

const recipeCollection = defineCollection({
  type: 'content',
  schema: z.object({
    // Required fields
    title: z.string(),
    image: z.string(),
    author: z.string(),

    // Timing (in minutes)
    prep_time: z.number().int().nonnegative(),
    cook_time: z.number().int().nonnegative(),

    // Serving
    servings: z.number().int().positive(),

    // Organization
    tags: z.array(z.enum(RECIPE_TAGS)).default([]),

    // Source attribution (optional)
    source: z
      .object({
        name: z.string(),
        url: z.string().url().optional(),
      })
      .optional(),

    // Tips shown at bottom (optional)
    notes: z.string().optional(),
  }),
});

export const collections = {
  recipes: recipeCollection,
};
