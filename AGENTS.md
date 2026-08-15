# AGENTS.md - Operational Learnings

This file captures operational learnings and patterns discovered during development.
Update this file when you learn something that would help future iterations.

## Code Patterns

### Recipe ingest is delegated to the `claude-runner` sidecar

`/api/import` is a thin proxy. It does not parse HTML, does not build PR
trees, and does not talk to GitHub. It forwards to `http://claude-runner:8080`
on the implicit Docker Compose network. The structured-extraction and
PR-creation logic lives in `sidecar/claude-runner/SYSTEM_PROMPT.md`, which
is the load-bearing artifact — version it deliberately.

Two stages:

- `POST /api/import?stage=preview` → JSON `{ url }` → forwards to sidecar
  `/extract` → returns the structured recipe Claude pulled out of the page.
- `POST /api/import?stage=submit` → multipart form (with `recipe` JSON,
  `author_name`, optional `image` upload) → cookbook resizes uploads with
  sharp, drops them on the shared `/uploads` volume, then forwards to
  sidecar `/publish` which opens the PR and returns `{ prUrl, slug }`.

### Uploaded images go via shared volume, not HTTP

`processImageUpload()` writes to `UPLOAD_DIR` (default `/uploads` in the
compose deploy). The sidecar mounts the same volume read-only and reads the
file directly — the cookbook never serves these files over HTTP. Astro's
node adapter in standalone mode only serves `dist/client/`, so writing to
`public/` at runtime would not be HTTP-reachable; the shared-volume
approach sidesteps that entirely.

URL-imported images stay as URLs the sidecar `curl`s.

## Configuration Notes

### Deployment (Dokploy)

The cookbook is deployed as a single Dokploy app pointing at this repo's
`docker-compose.yml`. That compose defines two services — the cookbook
itself and the `claude-runner` sidecar — and they share an implicit
network plus a `/uploads` volume.

In Dokploy:

1. App type: **Docker Compose**.
2. Source: this git repo, branch `main`.
3. Compose path: `docker-compose.yml`.
4. Build context: repo root.
5. Required env: `GITHUB_TOKEN` (fine-grained PAT, scoped to
   `ni3do/cookbook-website` with contents + pull-requests R/W).
6. Optional: `PUBLIC_BASE_URL`, `CLAUDE_MODEL`, `GITHUB_REPO`,
   `GIT_AUTHOR_NAME`, `GIT_AUTHOR_EMAIL`.
7. **Do NOT set `ANTHROPIC_API_KEY`** — overrides OAuth, bills the API account.

After the first deploy, log in once with subscription OAuth (this is what
the sidecar uses):

```bash
docker exec -it -u node -w /home/node claude-runner claude /login
```

Follow the URL in a browser, paste the code, exit. Token persists in
`/data/docker-volumes/cookbook/sidecar-claude/`.

### Volumes

- `/data/docker-volumes/cookbook/data/` → sqlite for ratings/comments
- `/data/docker-volumes/cookbook/uploads/` → temp staging for user uploads;
  shared between cookbook (RW) and sidecar (RO)
- `/data/docker-volumes/cookbook/sidecar-workdir/` → cached clone of
  `cookbook-website` so the sidecar doesn't re-clone on each PR
- `/data/docker-volumes/cookbook/sidecar-claude/` → subscription OAuth token

### Local development

`npm run dev` works without the sidecar — only the `/api/import` endpoint
needs it. To exercise the full flow locally, `cp .env.example .env`, fill in
`GITHUB_TOKEN`, then `docker compose up --build`. After first start, run the
`claude /login` exec command above against the local container.

## Common Issues

### Import sidecar exits before Claude receives its request

If `POST /api/import?stage=preview` returns a 502 whose detail says `claude exited 1` and `no stdin data received in 3s`, the deployed `claude-runner` is failing before extraction rather than rejecting the recipe URL. The cookbook content can still be added manually as a short-term recovery, but the sidecar invocation needs its stdin handling fixed before relying on URL imports again.
