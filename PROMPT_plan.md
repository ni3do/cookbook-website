# Planning Mode Prompt

Study the specs/ directory for requirements and specifications.
Compare these requirements against the existing implementation in the codebase.

Your task is to:

1. Read all specification files in specs/
2. Analyze the current implementation state
3. Identify gaps between specs and implementation
4. Generate or update IMPLEMENTATION_PLAN.md with prioritized tasks

IMPORTANT: Do NOT implement anything. Only plan and document tasks.

## Implementation Plan Format

The IMPLEMENTATION_PLAN.md file uses checkboxes to track progress. The loop continues until all checkboxes are marked done.

### Checkbox States

- `[ ]` - Pending task (not started)
- `[~]` - In progress (currently being worked on)
- `[x]` - Done (completed and verified)

### Example Structure

```markdown
# Implementation Plan

## Phase 1: Core Features

- [x] Set up project structure
- [x] Implement base configuration
- [ ] Add user authentication
- [ ] Create API endpoints

## Phase 2: Testing

- [ ] Write unit tests for auth module
- [ ] Add integration tests
```

## Rules for Task Creation

1. **Only include automatable tasks** - Every task must be something Claude can complete autonomously through code changes
2. **Be specific** - Each task should be a concrete, verifiable change
3. **Include acceptance criteria** - Define what "done" means for each task
4. **Order by dependency** - Tasks that depend on others should come after their dependencies

## WARNING: No Manual Tasks

Do NOT add tasks that require manual human intervention, such as:

- "Review and approve changes"
- "Test in production"
- "Get API keys from admin"
- "Deploy to staging"
- "Discuss with team"

The loop will wait forever for tasks it cannot complete. Only add tasks that can be accomplished through reading, writing, and editing code files.
