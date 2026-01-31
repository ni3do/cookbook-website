# The Kyburz Table - Development Commands

# Default recipe - show available commands
default:
    @just --list

# Start development server
dev:
    npm run dev

# Build for production
build:
    npm run build

# Preview production build
preview:
    npm run preview

# Run ESLint
lint:
    npm run lint

# Run ESLint with auto-fix
lint-fix:
    npm run lint:fix

# Format all files with Prettier
format:
    npm run format

# Check formatting
format-check:
    npm run format:check

# Run both lint and format
check: lint format-check

# Fix both lint and format issues
fix: lint-fix format

# Clean build artifacts
clean:
    rm -rf dist .astro

# Full rebuild
rebuild: clean build

# Install dependencies
install:
    npm install

# Update dependencies
update:
    npm update
