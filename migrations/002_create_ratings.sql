-- Migration: 002_create_ratings
-- Creates the ratings table for recipe ratings

CREATE TABLE IF NOT EXISTS ratings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_slug TEXT NOT NULL,
    author_name TEXT NOT NULL,
    rating INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Rating must be between 1 and 5
    CONSTRAINT rating_range CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT recipe_slug_not_empty CHECK (length(recipe_slug) > 0),
    CONSTRAINT author_name_not_empty CHECK (length(author_name) > 0)
);

-- Index for fetching ratings by recipe (most common query)
CREATE INDEX IF NOT EXISTS idx_ratings_recipe_slug ON ratings(recipe_slug);

-- Index for calculating averages efficiently
CREATE INDEX IF NOT EXISTS idx_ratings_recipe_rating ON ratings(recipe_slug, rating);
