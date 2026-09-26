import { execSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * Creates a temporary directory that is removed after the test.
 *
 * @param {import('node:test').TestContext} t
 * @returns {string}
 */
export function tmpDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vitest-bench-compare-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

/**
 * Creates a result in the shape of Vitest's `writeResult`.
 *
 * @param {number} mean Mean latency in milliseconds.
 */
export function result(mean) {
  return {
    latency: { mean, p99: mean * 2, rme: 1, samplesCount: 1000 },
    throughput: { mean: 1000 / mean },
    period: mean,
    totalTime: 1000,
  };
}

/**
 * Writes files relative to a root directory.
 *
 * @param {string} root
 * @param {Record<string, unknown>} files Paths mapped to contents. Objects are written as JSON.
 */
export function writeFiles(root, files) {
  for (const [file, content] of Object.entries(files)) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(
      target,
      typeof content === 'string' ? content : JSON.stringify(content),
    );
  }
}

/**
 * Runs git in a throwaway repository.
 *
 * @param {string} cwd
 * @param {string} args
 * @returns {string}
 */
export function git(cwd, args) {
  return execSync(
    `git -c user.name=test -c user.email=test@example.com -c commit.gpgsign=false ${args}`,
    { cwd, stdio: 'pipe' },
  )
    .toString()
    .trim();
}

/**
 * Creates a fake GitHub API that records requests.
 *
 * @param {object[]} existingComments Comments returned by the list endpoint.
 */
export function fakeGitHub(existingComments = []) {
  const requests = [];
  /** @type {typeof fetch} */
  const fetch = async (url, init) => {
    requests.push({
      method: init.method,
      url,
      body: init.body && JSON.parse(init.body),
    });
    const page = Number(new URL(url).searchParams.get('page') ?? 1);
    const data =
      init.method === 'GET'
        ? existingComments.slice((page - 1) * 100, page * 100)
        : {};
    return new Response(JSON.stringify(data), { status: 200 });
  };
  return { fetch, requests };
}
