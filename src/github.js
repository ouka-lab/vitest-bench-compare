import { MARKER } from './render.js';

/**
 * Creates the benchmark comment, or updates it if it already exists.
 *
 * @param {object} options
 * @param {string} options.token The GitHub token.
 * @param {string} options.repository The `owner/repo` name.
 * @param {number} options.issueNumber The pull request number.
 * @param {string} options.body The comment body.
 * @param {string} [options.apiUrl] The GitHub API URL.
 * @param {typeof fetch} [options.fetch] The fetch implementation.
 * @returns {Promise<'created' | 'updated'>} What was done.
 */
export async function upsertComment({
  token,
  repository,
  issueNumber,
  body,
  apiUrl = 'https://api.github.com',
  fetch = globalThis.fetch,
}) {
  const request = async (method, url, data) => {
    const response = await fetch(url, {
      method,
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: data && JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(
        `GitHub API ${method} ${url} failed: ${response.status} ${await response.text()}`,
      );
    }
    return response.json();
  };

  const existing = await findComment(request, apiUrl, repository, issueNumber);
  if (existing) {
    await request(
      'PATCH',
      `${apiUrl}/repos/${repository}/issues/comments/${existing.id}`,
      { body },
    );
    return 'updated';
  }
  await request(
    'POST',
    `${apiUrl}/repos/${repository}/issues/${issueNumber}/comments`,
    { body },
  );
  return 'created';
}

async function findComment(request, apiUrl, repository, issueNumber) {
  for (let page = 1; ; page++) {
    const comments = await request(
      'GET',
      `${apiUrl}/repos/${repository}/issues/${issueNumber}/comments?per_page=100&page=${page}`,
    );
    const found = comments.find((comment) => comment.body?.includes(MARKER));
    if (found || comments.length < 100) {
      return found;
    }
  }
}
