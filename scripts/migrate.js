#!/usr/bin/env node
/**
 * Database Migration Runner
 *
 * Runs SQL migrations in order, tracking which have been applied.
 * Usage: node scripts/migrate.js
 */

import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DATABASE_PATH = process.env.DATABASE_PATH || 'data/cookbook.db';
const MIGRATIONS_DIR = path.join(process.cwd(), 'migrations');

// Ensure data directory exists
const dataDir = path.dirname(DATABASE_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new Database(DATABASE_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Create migrations tracking table
db.exec(`
  CREATE TABLE IF NOT EXISTS _migrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Get list of applied migrations
const appliedMigrations = new Set(
  db
    .prepare('SELECT name FROM _migrations')
    .all()
    .map((row) => row.name)
);

// Get migration files sorted by name
const migrationFiles = fs
  .readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

let migrationsRun = 0;

for (const file of migrationFiles) {
  if (appliedMigrations.has(file)) {
    console.log(`✓ ${file} (already applied)`);
    continue;
  }

  const filePath = path.join(MIGRATIONS_DIR, file);
  const sql = fs.readFileSync(filePath, 'utf-8');

  try {
    db.exec(sql);
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    console.log(`✓ ${file} (applied)`);
    migrationsRun++;
  } catch (error) {
    console.error(`✗ ${file} failed:`, error.message);
    process.exit(1);
  }
}

db.close();

if (migrationsRun === 0) {
  console.log('\nNo new migrations to apply.');
} else {
  console.log(`\n${migrationsRun} migration(s) applied successfully.`);
}
