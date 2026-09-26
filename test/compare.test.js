import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, test } from 'node:test';
import { compareResults, diffPercent } from '../src/compare.js';
import { result, tmpDir, writeFiles } from './helpers.js';

describe('compareResults', () => {
  test('matches results by relative path and splits folder and file name', (t) => {
    const dir = tmpDir(t);
    const currentDir = path.join(dir, 'current');
    const compareDir = path.join(dir, 'compare');
    writeFiles(currentDir, {
      'root.json': result(1),
      'methods/parse/foo.parse.json': result(2),
      'methods/parse/removed.json': result(3),
    });
    writeFiles(compareDir, {
      'root.json': result(1.5),
      'methods/parse/foo.parse.json': result(1),
      'schemas/object/added.json': result(4),
    });

    assert.deepEqual(compareResults(currentDir, compareDir), [
      {
        group: 'methods/parse',
        name: 'foo.parse',
        current: result(2),
        compare: result(1),
      },
      {
        group: 'methods/parse',
        name: 'removed',
        current: result(3),
        compare: undefined,
      },
      { group: '', name: 'root', current: result(1), compare: result(1.5) },
      {
        group: 'schemas/object',
        name: 'added',
        current: undefined,
        compare: result(4),
      },
    ]);
  });

  test('returns an empty array when both directories are missing', (t) => {
    const dir = tmpDir(t);
    assert.deepEqual(
      compareResults(path.join(dir, 'current'), path.join(dir, 'compare')),
      [],
    );
  });
});

describe('diffPercent', () => {
  test('is positive when the pull request is faster', () => {
    assert.equal(diffPercent(result(2), result(1)), 100);
  });

  test('is negative when the pull request is slower', () => {
    assert.equal(diffPercent(result(1), result(2)), -50);
  });

  test('is zero when both are equal', () => {
    assert.equal(diffPercent(result(1), result(1)), 0);
  });
});
