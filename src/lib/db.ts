/**
 * Database Connection Module
 *
 * Provides a singleton SQLite database connection using better-sqlite3.
 * The database file location is configured via the DATABASE_PATH environment variable.
 */

import Database from 'better-sqlite3';

/** Database file path - defaults to data/cookbook.db in the project root */
const DATABASE_PATH = import.meta.env.DATABASE_PATH || 'data/cookbook.db';

/** Singleton database instance */
let db: Database.Database | null = null;

/**
 * Database connection error for typed error handling.
 */
export class DatabaseError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

/**
 * Gets the database connection, creating it if it doesn't exist.
 * The connection is cached as a singleton for reuse.
 *
 * @returns The SQLite database instance
 * @throws {DatabaseError} If the connection cannot be established
 */
export function getDb(): Database.Database {
  if (db) return db;

  try {
    db = new Database(DATABASE_PATH);

    // Enable WAL mode for better concurrent read performance
    db.pragma('journal_mode = WAL');

    // Enable foreign key constraints
    db.pragma('foreign_keys = ON');

    return db;
  } catch (error) {
    throw new DatabaseError(
      `Failed to connect to database at ${DATABASE_PATH}`,
      error
    );
  }
}

/**
 * Closes the database connection.
 * Call this during graceful shutdown.
 */
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}

/**
 * Executes a function within a transaction.
 * Automatically commits on success, rolls back on error.
 *
 * @param fn - The function to execute within the transaction
 * @returns The result of the function
 * @throws {DatabaseError} If the transaction fails
 */
export function withTransaction<T>(fn: () => T): T {
  const database = getDb();

  const transaction = database.transaction(() => {
    return fn();
  });

  try {
    return transaction();
  } catch (error) {
    throw new DatabaseError('Transaction failed', error);
  }
}

/**
 * Checks if the database connection is healthy.
 *
 * @returns true if the database is accessible
 */
export function isDbHealthy(): boolean {
  try {
    const database = getDb();
    database.prepare('SELECT 1').get();
    return true;
  } catch {
    return false;
  }
}
