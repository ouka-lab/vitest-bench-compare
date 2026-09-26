import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { benchAt } from './bench.js';
import { compareResults } from './compare.js';
import { upsertComment } from './github.js';
import { renderComment } from './render.js';

/**
 * Runs the whole flow: base branch → pull request → comment.
 * In dry-run mode, the comment is printed to stdout instead of being posted.
 *
 * @param {NodeJS.ProcessEnv} env The environment variables.
 * @param {{ fetch?: typeof fetch }} [deps] Injectable dependencies for tests.
 * @returns {Promise<string>} The comment body.
 */
export async function main(env, { fetch } = {}) {
  const workspace = env.GITHUB_WORKSPACE ?? process.cwd();
  const event = JSON.parse(fs.readFileSync(env.GITHUB_EVENT_PATH, 'utf8'));
  const pullRequest = event.pull_request;
  if (!pullRequest) {
    throw new Error('vitest-bench-compare only supports pull_request events');
  }

  const dir = path.resolve(workspace, required(env, 'INPUT_DIR'));
  const currentDir = path.join(dir, 'current');
  const compareDir = path.join(dir, 'compare');
  const options = {
    workspace,
    workingDirectory: env.INPUT_WORKING_DIRECTORY || '.',
    install: env.INPUT_INSTALL ?? '',
    run: required(env, 'INPUT_RUN'),
    source: required(env, 'INPUT_SOURCE'),
  };

  benchAt({ ...options, sha: pullRequest.base.sha, dest: currentDir });
  benchAt({ ...options, sha: pullRequest.head.sha, dest: compareDir });

  const body = renderComment(compareResults(currentDir, compareDir), {
    currentSha: pullRequest.base.sha,
    compareSha: pullRequest.head.sha,
  });

  if (env.INPUT_DRY_RUN === 'true') {
    console.log('Dry run: skipped posting the comment. Comment body:\n');
    console.log(body);
    return body;
  }

  const result = await upsertComment({
    token: required(env, 'INPUT_GITHUB_TOKEN'),
    repository: required(env, 'GITHUB_REPOSITORY'),
    issueNumber: pullRequest.number,
    body,
    apiUrl: env.GITHUB_API_URL,
    fetch,
  });
  console.log(`Benchmark comment ${result}`);
  return body;
}

/**
 * @param {NodeJS.ProcessEnv} env
 * @param {string} name
 * @returns {string}
 */
function required(env, name) {
  const value = env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main(process.env).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
