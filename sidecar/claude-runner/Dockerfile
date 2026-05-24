FROM node:22-slim

# OS deps: git for repo ops, curl for image fetch + gh keyring, webp for image conversion,
# ca-certificates so HTTPS works, gosu so we can drop privileges from the entrypoint.
RUN apt-get update && apt-get install -y \
    git \
    curl \
    ca-certificates \
    gnupg \
    webp \
    gosu \
    && rm -rf /var/lib/apt/lists/*

# GitHub CLI from the official APT repo
RUN mkdir -p -m 755 /etc/apt/keyrings && \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg \
      | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null && \
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" \
      > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && apt-get install -y gh && rm -rf /var/lib/apt/lists/*

# Claude Code CLI (the load-bearing dependency)
RUN npm install -g @anthropic-ai/claude-code

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev

COPY server.js ./
COPY SYSTEM_PROMPT.md ./
COPY entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# /workdir holds the cookbook-website clone; persisted via volume mount
RUN mkdir -p /workdir && chown -R node:node /workdir /app

# Pre-create the claude config dir so the volume mount inherits the right
# ownership on first start. Auth tokens land in /home/node/.claude/.credentials.json.
RUN mkdir -p /home/node/.claude /home/node/.config && \
    chown -R node:node /home/node

EXPOSE 8080
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
CMD ["node", "/app/server.js"]
