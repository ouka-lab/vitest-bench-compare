import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { upsertComment } from '../src/github.js';
import { MARKER } from '../src/render.js';
import { fakeGitHub } from './helpers.js';

const options = {
  token: 'token',
  repository: 'owner/repo',
  issueNumber: 12,
  body: `${MARKER}\nbody`,
  apiUrl: 'https://api.test',
};

describe('upsertComment', () => {
  test('creates a comment when none exists', async () => {
    const { fetch, requests } = fakeGitHub([{ id: 1, body: 'unrelated' }]);

    assert.equal(await upsertComment({ ...options, fetch }), 'created');
    assert.deepEqual(requests.at(-1), {
      method: 'POST',
      url: 'https://api.test/repos/owner/repo/issues/12/comments',
      body: { body: options.body },
    });
  });

  test('updates the comment that has the marker', async () => {
    const { fetch, requests } = fakeGitHub([
      { id: 1, body: 'unrelated' },
      { id: 2, body: `${MARKER}\nold` },
    ]);

    assert.equal(await upsertComment({ ...options, fetch }), 'updated');
    assert.deepEqual(requests.at(-1), {
      method: 'PATCH',
      url: 'https://api.test/repos/owner/repo/issues/comments/2',
      body: { body: options.body },
    });
  });

  test('searches following pages for the marker', async () => {
    const comments = Array.from({ length: 150 }, (_, i) => ({
      id: i,
      body: i === 120 ? MARKER : 'unrelated',
    }));
    const { fetch, requests } = fakeGitHub(comments);

    assert.equal(await upsertComment({ ...options, fetch }), 'updated');
    assert.deepEqual(
      requests.map((request) => request.method),
      ['GET', 'GET', 'PATCH'],
    );
    assert.match(requests.at(-1).url, /\/comments\/120$/);
  });

  test('throws when the API responds with an error', async () => {
    const fetch = async () => new Response('Forbidden', { status: 403 });

    await assert.rejects(
      upsertComment({ ...options, fetch }),
      /GitHub API GET .* failed: 403 Forbidden/,
    );
  });
});
