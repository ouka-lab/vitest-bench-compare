import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { MARKER, renderComment } from '../src/render.js';
import { result } from './helpers.js';

const shas = { currentSha: 'aaaaaaa1111', compareSha: 'bbbbbbb2222' };

describe('renderComment', () => {
  test('groups rows by folder and puts root files without a heading', () => {
    const body = renderComment(
      [
        { group: '', name: 'root', current: result(1), compare: result(1) },
        {
          group: 'methods/parse',
          name: 'foo.parse',
          current: result(1),
          compare: result(1),
        },
        {
          group: 'methods/parse',
          name: 'bar.parse',
          current: result(1),
          compare: result(1),
        },
      ],
      shas,
    );

    assert.equal(
      body,
      [
        MARKER,
        '## ⏱️ Benchmark results',
        '',
        'current: `aaaaaaa` (base) / compare: `bbbbbbb` (pull request)',
        '',
        '| bench | current ops/sec | compare ops/sec | diff |',
        '| --- | ---: | ---: | :--- |',
        '| root | 1,000 | 1,000 | ➖ +0.00% |',
        '',
        '### methods/parse',
        '',
        '| bench | current ops/sec | compare ops/sec | diff |',
        '| --- | ---: | ---: | :--- |',
        '| foo.parse | 1,000 | 1,000 | ➖ +0.00% |',
        '| bar.parse | 1,000 | 1,000 | ➖ +0.00% |',
        '',
        'Diff is based on mean latency. Changes within ±5% are treated as noise.',
      ].join('\n'),
    );
  });

  test('marks faster, slower and noise-level changes', () => {
    const body = renderComment(
      [
        { group: '', name: 'faster', current: result(2), compare: result(1) },
        { group: '', name: 'slower', current: result(1), compare: result(2) },
        {
          group: '',
          name: 'noise',
          current: result(1.02),
          compare: result(1),
        },
      ],
      shas,
    );

    assert.match(body, /\| faster \| 500 \| 1,000 \| 🚀 \+100\.00% \|/);
    assert.match(body, /\| slower \| 1,000 \| 500 \| 🐢 -50\.00% \|/);
    assert.match(body, /\| noise \| .* \| ➖ \+2\.00% \|/);
  });

  test('marks results that exist on only one side', () => {
    const body = renderComment(
      [
        { group: '', name: 'added', current: undefined, compare: result(1) },
        { group: '', name: 'removed', current: result(1), compare: undefined },
      ],
      shas,
    );

    assert.match(body, /\| added \| - \| 1,000 \| 🆕 new \|/);
    assert.match(body, /\| removed \| 1,000 \| - \| 🗑️ removed \|/);
  });

  test('renders a message when there are no results', () => {
    const body = renderComment([], shas);

    assert.ok(body.startsWith(MARKER));
    assert.match(body, /No benchmark results found\./);
    assert.doesNotMatch(body, /\| bench \|/);
  });
});
