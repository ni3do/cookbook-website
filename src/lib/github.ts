import { Octokit } from '@octokit/rest';

const REPO_OWNER = 'ni3do';
const REPO_NAME = 'cookbook-website';
const BASE_BRANCH = 'main';

interface SubmissionData {
  authorName: string;
  title: string;
  description: string;
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  tags: string[];
  sourceName?: string;
  sourceUrl?: string;
  ingredients: Array<{ amount: string; name: string }>;
  steps: string[];
  notes?: string;
}

export function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function generateRecipeMarkdown(
  data: SubmissionData,
  imageFilename: string
): string {
  const lines: string[] = ['---'];
  lines.push(`title: '${data.title.replace(/'/g, "''")}'`);
  lines.push(`image: '${imageFilename}'`);
  lines.push(`author: '${data.authorName.replace(/'/g, "''")}'`);
  if (data.prepTime != null) lines.push(`prep_time: ${data.prepTime}`);
  if (data.cookTime != null) lines.push(`cook_time: ${data.cookTime}`);
  if (data.servings != null) lines.push(`servings: ${data.servings}`);
  if (data.tags.length > 0) {
    lines.push(`tags: [${data.tags.join(', ')}]`);
  }
  if (data.sourceName) {
    lines.push('source:');
    lines.push(`  name: '${data.sourceName.replace(/'/g, "''")}'`);
    if (data.sourceUrl) {
      lines.push(`  url: '${data.sourceUrl}'`);
    }
  }
  if (data.notes) {
    lines.push('notes: |');
    for (const line of data.notes.split('\n')) {
      lines.push(`  ${line}`);
    }
  }
  lines.push('---');
  lines.push('');
  lines.push('## Ingredients');
  lines.push('');
  for (const ing of data.ingredients) {
    if (ing.amount) {
      lines.push(`- \`${ing.amount}\` ${ing.name}`);
    } else {
      lines.push(`- ${ing.name}`);
    }
  }
  lines.push('');
  lines.push('## Steps');
  lines.push('');
  data.steps.forEach((step, i) => {
    lines.push(`${i + 1}. ${step}`);
    lines.push('');
  });

  return lines.join('\n');
}

export async function createRecipePR(
  data: SubmissionData,
  imageBuffer: Buffer
): Promise<{ prUrl: string; slug: string } | null> {
  const token = import.meta.env.GITHUB_TOKEN;
  if (!token) return null;

  try {
    const octokit = new Octokit({ auth: token });

    // 1. Get main branch HEAD
    const { data: ref } = await octokit.git.getRef({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      ref: `heads/${BASE_BRANCH}`,
    });
    const baseSha = ref.object.sha;

    const { data: baseCommit } = await octokit.git.getCommit({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      commit_sha: baseSha,
    });
    const baseTreeSha = baseCommit.tree.sha;

    // 2. Generate slug with collision check
    let slug = slugify(data.title);
    let suffix = 1;
    while (true) {
      try {
        await octokit.repos.getContent({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          path: `src/content/recipes/${slug}.md`,
          ref: BASE_BRANCH,
        });
        suffix++;
        slug = `${slugify(data.title)}-${suffix}`;
      } catch {
        break; // 404 means no collision
      }
    }

    const imageFilename = `${slug}.webp`;
    const markdown = generateRecipeMarkdown(data, imageFilename);

    // 3. Create blobs
    const [imageBlob, mdBlob] = await Promise.all([
      octokit.git.createBlob({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        content: imageBuffer.toString('base64'),
        encoding: 'base64',
      }),
      octokit.git.createBlob({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        content: markdown,
        encoding: 'utf-8',
      }),
    ]);

    // 4. Create tree
    const { data: tree } = await octokit.git.createTree({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      base_tree: baseTreeSha,
      tree: [
        {
          path: `src/content/recipes/${slug}.md`,
          mode: '100644',
          type: 'blob',
          sha: mdBlob.data.sha,
        },
        {
          path: `public/images/recipes/${imageFilename}`,
          mode: '100644',
          type: 'blob',
          sha: imageBlob.data.sha,
        },
      ],
    });

    // 5. Create commit
    const { data: commit } = await octokit.git.createCommit({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      message: `feat: add recipe "${data.title}"`,
      tree: tree.sha,
      parents: [baseSha],
    });

    // 6. Create branch (with collision check)
    let branchName = `recipe/${slug}`;
    let branchSuffix = 1;
    while (true) {
      try {
        await octokit.git.createRef({
          owner: REPO_OWNER,
          repo: REPO_NAME,
          ref: `refs/heads/${branchName}`,
          sha: commit.sha,
        });
        break;
      } catch (err: unknown) {
        const status = (err as { status?: number }).status;
        if (status === 422) {
          branchSuffix++;
          branchName = `recipe/${slug}-${branchSuffix}`;
        } else {
          throw err;
        }
      }
    }

    // 7. Create PR
    const prBody = [
      '## New Recipe Submission',
      '',
      `**${data.title}** by ${data.authorName}`,
      '',
      data.description,
      '',
      `- Prep: ${data.prepTime ?? '?'} min | Cook: ${data.cookTime ?? '?'} min | Servings: ${data.servings ?? '?'}`,
      `- Tags: ${data.tags.length > 0 ? data.tags.join(', ') : 'none'}`,
      `- ${data.ingredients.length} ingredients, ${data.steps.length} steps`,
      '',
      '---',
      '*Submitted via the recipe form*',
    ].join('\n');

    const { data: pr } = await octokit.pulls.create({
      owner: REPO_OWNER,
      repo: REPO_NAME,
      title: `New recipe: ${data.title}`,
      body: prBody,
      head: branchName,
      base: BASE_BRANCH,
    });

    return { prUrl: pr.html_url, slug };
  } catch (error) {
    console.error('Failed to create recipe PR:', error);
    return null;
  }
}
