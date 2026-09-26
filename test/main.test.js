import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { listResults } from '../src/files.js';
import { main } from '../src/main.js';
import { fakeGitHub, git, result, tmpDir, writeFiles } from './helpers.js';

/**
 * Creates a repository whose `bench.mjs` writes the given results into
 * `pkg/benchmarks`, like Vitest's `writeResult` would.
 */
function writeBenchScript(repo, results) {
  writeFiles(repo, {
    'pkg/bench.mjs': [
      "import fs from 'node:fs';",
      "import path from 'node:path';",
      `for (const [file, data] of Object.entries(${JSON.stringify(results)})) {`,
      "  const target = path.join('benchmarks', file);",
      '  fs.mkdirSync(path.dirname(target), { recursive: true });',
      '  fs.writeFileSync(target, JSON.stringify(data));',
      '}',
    ].join('\n'),
  });
}

function setup(t) {
  const root = tmpDir(t);
  const repo = path.join(root, 'repo');
  fs.mkdirSync(repo);
  git(repo, 'init -q');
  writeFiles(repo, { '.gitignore': 'benchmarks/\ninstalled.txt\n' });

  // Base branch
  writeBenchScript(repo, {
    'root.json': result(1),
    'methods/parse/foo.parse.json': result(2),
    'methods/parse/removed.json': result(1),
  });
  git(repo, 'add -A');
  git(repo, 'commit -q -m base');
  const baseSha = git(repo, 'rev-parse HEAD');

  // Pull request
  writeBenchScript(repo, {
    'root.json': result(1),
    'methods/parse/foo.parse.json': result(1),
    'schemas/object/added.json': result(1),
  });
  git(repo, 'commit -q -am pr');
  const headSha = git(repo, 'rev-parse HEAD');

  const eventPath = path.join(root, 'event.json');
  fs.writeFileSync(
    eventPath,
    JSON.stringify({
      pull_request: {
        number: 7,
        base: { sha: baseSha },
        head: { sha: headSha },
      },
    }),
  );

  const env = {
    GITHUB_WORKSPACE: repo,
    GITHUB_EVENT_PATH: eventPath,
    GITHUB_REPOSITORY: 'owner/repo',
    GITHUB_API_URL: 'https://api.test',
    INPUT_DIR: path.join(root, 'bench'),
    INPUT_SOURCE: 'pkg/benchmarks',
    INPUT_RUN: 'node bench.mjs',
    INPUT_INSTALL:
      "node -e \"require('fs').appendFileSync('installed.txt', 'x')\"",
    INPUT_WORKING_DIRECTORY: 'pkg',
    INPUT_GITHUB_TOKEN: 'token',
  };
  return { root, repo, env, baseSha, headSha };
}

describe('main', () => {
  test('benchmarks base and pull request, then posts the comparison', async (t) => {
    const { root, repo, env, headSha } = setup(t);
    const { fetch, requests } = fakeGitHub();

    const body = await main(env, { fetch });

    // Results are collected into `current/` (base) and `compare/` (pull request)
    assert.deepEqual(listResults(path.join(root, 'bench/current')), [
      'methods/parse/foo.parse.json',
      'methods/parse/removed.json',
      'root.json',
    ]);
    assert.deepEqual(listResults(path.join(root, 'bench/compare')), [
      'methods/parse/foo.parse.json',
      'root.json',
      'schemas/object/added.json',
    ]);

    // Stale results of the base run are not carried over to the pull request run
    assert.doesNotMatch(
      fs.readdirSync(path.join(root, 'bench/compare/methods/parse')).join(),
      /removed/,
    );

    // `install` runs in the working directory after each checkout
    assert.equal(
      fs.readFileSync(path.join(repo, 'pkg/installed.txt'), 'utf8'),
      'xx',
    );

    // The workspace ends up on the pull request commit
    assert.equal(git(repo, 'rev-parse HEAD'), headSha);

    assert.match(body, /\| root \| 1,000 \| 1,000 \| ➖ \+0\.00% \|/);
    assert.match(body, /### methods\/parse/);
    assert.match(body, /\| foo\.parse \| 500 \| 1,000 \| 🚀 \+100\.00% \|/);
    assert.match(body, /\| removed \| 1,000 \| - \| 🗑️ removed \|/);
    assert.match(body, /### schemas\/object/);
    assert.match(body, /\| added \| - \| 1,000 \| 🆕 new \|/);

    assert.deepEqual(requests.at(-1), {
      method: 'POST',
      url: 'https://api.test/repos/owner/repo/issues/7/comments',
      body: { body },
    });
  });

  test('skips install when it is empty', async (t) => {
    const { repo, env } = setup(t);
    const { fetch } = fakeGitHub();

    await main({ ...env, INPUT_INSTALL: '' }, { fetch });

    assert.ok(!fs.existsSync(path.join(repo, 'pkg/installed.txt')));
  });

  test('fails when the benchmark command fails', async (t) => {
    const { env } = setup(t);
    const { fetch, requests } = fakeGitHub();

    await assert.rejects(
      main({ ...env, INPUT_RUN: 'node -e "process.exit(1)"' }, { fetch }),
    );
    assert.equal(requests.length, 0);
  });

  test('fails outside of pull_request events', async (t) => {
    const { root, env } = setup(t);
    const eventPath = path.join(root, 'push.json');
    fs.writeFileSync(eventPath, JSON.stringify({ ref: 'refs/heads/main' }));

    await assert.rejects(
      main({ ...env, GITHUB_EVENT_PATH: eventPath }),
      /only supports pull_request events/,
    );
  });

  test('fails when a required input is missing', async (t) => {
    const { env } = setup(t);

    await assert.rejects(
      main({ ...env, INPUT_RUN: '' }),
      /INPUT_RUN is required/,
    );
  });
});
