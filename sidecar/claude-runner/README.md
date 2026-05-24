# claude-runner

Sidecar that fronts Claude Code for the cookbook's `/api/import` flow.
Lives in this repo because it exists only to serve cookbook submissions —
deploy it as part of `docker-compose.yml` at the repo root, not standalone.

## What it does

Two HTTP endpoints (`/extract`, `/publish`) wrap `claude -p` with a versioned
system prompt. Claude does the actual scraping, markdown generation, and
PR opening; this server just shells out to the CLI.

## Files

- `Dockerfile` — Node 22 + `gh` + `git` + `webp` (cwebp) + `@anthropic-ai/claude-code`
- `entrypoint.sh` — clones `ni3do/cookbook-website`, configures `gh`, sets `HOME=/home/node`
- `server.js` — Express wrapper, ~150 LOC
- `SYSTEM_PROMPT.md` — **load-bearing**; defines extract + publish behaviour
- `package.json` — just `express`

## Auth: subscription OAuth, persisted via volume

This service uses Pro/Max OAuth, not an API key. The token lives in
`/home/node/.claude/.credentials.json`, which is volume-mounted to
`/data/docker-volumes/cookbook/sidecar-claude/` (declared in the parent
`docker-compose.yml`). Restarts and image rebuilds preserve it.

After the first start the credentials file doesn't exist yet — the
entrypoint logs a warning and starts the server anyway. Log in once:

```bash
docker exec -it -u node -w /home/node claude-runner claude /login
```

Follow the OAuth URL in a browser, paste the verification code, exit.
Verify it stuck:

```bash
docker exec -u node claude-runner ls /home/node/.claude/.credentials.json
docker logs --tail 20 claude-runner   # the WARNING line should be gone
```

**Do NOT set `ANTHROPIC_API_KEY`** in the cookbook env — if present, the CLI
silently prefers it over OAuth and bills the API account instead. The
server strips it from the spawn env as a safety belt, but easier not to
set it in the first place.

## Image handling

The `/publish` endpoint accepts one of:

- `image_url` — Claude `curl`s it (used when a recipe was imported from a URL).
- `image_path` — absolute path inside the container; Claude `cp`s it (used
  when the user uploaded a photo, in which case the cookbook has already
  resized it to webp and dropped it on the shared `/uploads` volume).

The shared volume is mounted read-only on the sidecar side.

## Operational notes

- `docker logs -f claude-runner` shows every claude invocation. Each
  `/extract` is a few seconds; `/publish` is 30-90s.
- The sidecar fails closed: if OAuth expires or the GitHub token rotates,
  `/extract` and `/publish` return 502 to the cookbook, the form shows an
  error, and no PR is created. Re-run `claude /login` or update
  `GITHUB_TOKEN` and redeploy.
- The cached repo clone at `/workdir/cookbook-website` accumulates objects
  over time. Run `git gc` inside the container occasionally if it bloats.
- **Subscription ToS:** Pro/Max OAuth is described as personal/interactive.
  At cookbook submission volume this is fine; if traffic spikes, move to an
  API key (set `ANTHROPIC_API_KEY` and remove the `delete` lines in
  `server.js`).
