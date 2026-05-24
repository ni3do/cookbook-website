#!/bin/sh
set -e

# Claude Code (and gh / git) read their config from $HOME. We drop to the
# `node` user via gosu later, but gosu doesn't reset HOME — without this
# export, HOME stays /root and the OAuth token would land outside the
# persistent volume.
export HOME=/home/node

REPO_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${GITHUB_REPO:-ni3do/cookbook-website}.git"
WORKDIR="${WORKDIR:-/workdir}"
CLONE_DIR="${WORKDIR}/cookbook-website"

mkdir -p "${WORKDIR}"
chown -R node:node "${WORKDIR}"

# /home/node/.claude is volume-mounted; on a fresh volume it's owned by root,
# which would prevent the node user from writing OAuth tokens. Fix ownership
# every start (idempotent).
mkdir -p /home/node/.claude
chown -R node:node /home/node/.claude

# Clone or refresh the cookbook repo
if [ ! -d "${CLONE_DIR}/.git" ]; then
  echo "[entrypoint] cloning cookbook repo into ${CLONE_DIR}"
  gosu node git clone "${REPO_URL}" "${CLONE_DIR}"
else
  echo "[entrypoint] refreshing cookbook repo at ${CLONE_DIR}"
  gosu node git -C "${CLONE_DIR}" remote set-url origin "${REPO_URL}"
  gosu node git -C "${CLONE_DIR}" fetch --prune origin || true
fi

# Identity used for commits (local repo config, doesn't depend on $HOME)
gosu node git -C "${CLONE_DIR}" config user.name "${GIT_AUTHOR_NAME:-Cookbook Bot}"
gosu node git -C "${CLONE_DIR}" config user.email "${GIT_AUTHOR_EMAIL:-cookbook-bot@siwachter.com}"

# gh CLI auth (so `gh pr create` works without a browser).
# gh already picks up GITHUB_TOKEN from the env automatically; running an
# explicit `gh auth login --with-token` while that var is set makes gh exit
# non-zero, which (under `set -e`) would kill the container before the server
# starts. Only do the explicit login as a fallback when the env var is absent.
if [ -z "${GITHUB_TOKEN}" ]; then
  echo "${GITHUB_TOKEN}" | gosu node gh auth login --with-token
fi

# Warn loudly if subscription auth hasn't been set up yet — we still start
# the server so the operator can `docker exec` in to log in.
if [ ! -f /home/node/.claude/.credentials.json ]; then
  echo "[entrypoint] WARNING: no Claude subscription auth found at /home/node/.claude/.credentials.json"
  echo "[entrypoint] run: docker exec -it -u node -w /home/node claude-runner claude /login"
fi

exec gosu node "$@"
