-- Migration: 001_create_comments
-- Creates the comments table for recipe comments

CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_slug TEXT NOT NULL,
    author_name TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,

    -- Index for efficient lookup by recipe
    CONSTRAINT recipe_slug_not_empty CHECK (length(recipe_slug) > 0),
    CONSTRAINT author_name_not_empty CHECK (length(author_name) > 0),
    CONSTRAINT content_not_empty CHECK (length(content) > 0)
);

-- Index for fetching comments by recipe (most common query)
CREATE INDEX IF NOT EXISTS idx_comments_recipe_slug ON comments(recipe_slug);

-- Index for ordering by creation date
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
