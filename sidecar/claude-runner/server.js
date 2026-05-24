// Claude-runner sidecar: a thin HTTP wrapper that runs the official `claude`
// CLI with our versioned system prompt. Two endpoints, /extract and /publish,
// match the cookbook's two-stage import flow.

import express from 'express';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const app = express();
app.use(express.json({ limit: '2mb' }));

const PORT = Number(process.env.PORT || 8080);
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';
const SYSTEM_PROMPT_PATH =
  process.env.SYSTEM_PROMPT_PATH || '/app/SYSTEM_PROMPT.md';
const WORKDIR = process.env.WORKDIR || '/workdir';
const SYSTEM_PROMPT = readFileSync(SYSTEM_PROMPT_PATH, 'utf8');

// Default tool allowlist — Bash covers git/gh/curl/cwebp; Read/Write touch the repo;
// WebFetch lets Claude grab pages it can't reach via Bash for some reason.
const ALLOWED_TOOLS = 'Bash,Read,Write,WebFetch';

function runClaude(userPrompt, { timeoutMs = 240_000 } = {}) {
  return new Promise((resolve, reject) => {
    const args = [
      '-p',
      userPrompt,
      '--model',
      MODEL,
      '--append-system-prompt',
      SYSTEM_PROMPT,
      '--output-format',
      'json',
      '--allowedTools',
      ALLOWED_TOOLS,
      '--permission-mode',
      'bypassPermissions',
    ];

    // We run on subscription OAuth (token at $HOME/.claude/.credentials.json).
    // If ANTHROPIC_API_KEY is in the env, the CLI silently prefers it and
    // bills the API account instead — strip it as a safety belt.
    const childEnv = { ...process.env };
    delete childEnv.ANTHROPIC_API_KEY;
    delete childEnv.ANTHROPIC_AUTH_TOKEN;

    const child = spawn('claude', args, {
      cwd: WORKDIR,
      env: childEnv,
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        child.kill('SIGKILL');
        reject(new Error(`claude timed out after ${timeoutMs}ms`));
      }
    }, timeoutMs);

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });

    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (code !== 0) {
        return reject(
          new Error(`claude exited ${code}: ${stderr.slice(0, 1500)}`)
        );
      }
      resolve(stdout);
    });
  });
}

// `claude --output-format json` returns a wrapper object whose `result` field
// contains the assistant's last message. We pull that out, then try to parse
// it as JSON. If the model wrapped its JSON in fences or added prose despite
// the system prompt, recover the JSON object from inside the text.
function parseClaudeOutput(raw) {
  let envelope;
  try {
    envelope = JSON.parse(raw);
  } catch {
    throw new Error(
      `could not parse claude wrapper JSON: ${raw.slice(0, 300)}`
    );
  }

  const finalText =
    typeof envelope.result === 'string'
      ? envelope.result
      : JSON.stringify(envelope);

  // Direct parse first
  try {
    return JSON.parse(finalText.trim());
  } catch {
    // Strip fenced code block if present
    const fence = finalText.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fence) {
      try {
        return JSON.parse(fence[1].trim());
      } catch {
        /* fall through */
      }
    }
    // Last resort: pull out the largest brace-balanced JSON object
    const brace = finalText.match(/\{[\s\S]*\}/);
    if (brace) {
      try {
        return JSON.parse(brace[0]);
      } catch {
        /* fall through */
      }
    }
  }
  throw new Error(
    `claude did not return JSON. First 300 chars: ${finalText.slice(0, 300)}`
  );
}

app.get('/healthz', (_req, res) => res.send('ok'));

app.post('/extract', async (req, res) => {
  const { url } = req.body ?? {};
  if (typeof url !== 'string' || !url.trim()) {
    return res.status(400).json({ error: 'url is required' });
  }

  try {
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'url is not valid' });
  }

  const prompt = `Extract the recipe from this URL and return the structured JSON described in the system prompt:\n\n${url}`;

  try {
    const raw = await runClaude(prompt, { timeoutMs: 120_000 });
    const parsed = parseClaudeOutput(raw);
    if (parsed.error) return res.status(422).json(parsed);
    res.json(parsed);
  } catch (err) {
    console.error('[extract] failed:', err);
    res.status(502).json({ error: err.message });
  }
});

app.post('/publish', async (req, res) => {
  const { recipe, image_url, image_path, author_name } = req.body ?? {};
  if (!recipe || typeof recipe !== 'object') {
    return res.status(400).json({ error: 'recipe is required' });
  }
  const hasUrl = typeof image_url === 'string' && image_url.trim();
  const hasPath = typeof image_path === 'string' && image_path.trim();
  if (!hasUrl && !hasPath) {
    return res
      .status(400)
      .json({ error: 'image_url or image_path is required' });
  }
  if (typeof author_name !== 'string' || !author_name.trim()) {
    return res.status(400).json({ error: 'author_name is required' });
  }

  const promptLines = [
    'Publish the following recipe to the cookbook-website repo per the procedure in the system prompt.',
    '',
  ];
  if (hasUrl) promptLines.push(`IMAGE_URL=${image_url}`);
  if (hasPath) promptLines.push(`IMAGE_PATH=${image_path}`);
  promptLines.push(
    `AUTHOR_NAME=${author_name}`,
    '',
    'RECIPE_JSON:',
    '```json',
    JSON.stringify(recipe, null, 2),
    '```',
    '',
    'Output only the final {"prUrl":..., "slug":...} JSON.'
  );
  const prompt = promptLines.join('\n');

  try {
    const raw = await runClaude(prompt, { timeoutMs: 300_000 });
    const parsed = parseClaudeOutput(raw);
    if (parsed.error) return res.status(422).json(parsed);
    res.json(parsed);
  } catch (err) {
    console.error('[publish] failed:', err);
    res.status(502).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(
    `claude-runner listening on :${PORT} (model=${MODEL}, workdir=${WORKDIR})`
  );
});
