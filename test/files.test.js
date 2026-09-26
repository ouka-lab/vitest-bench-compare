import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';
import { copyResults, listResults } from '../src/files.js';
import { result, tmpDir, writeFiles } from './helpers.js';

describe('listResults', () => {
  test('lists JSON files recursively as sorted relative paths', (t) => {
    const dir = tmpDir(t);
    writeFiles(dir, {
      'root.json': result(1),
      'methods/parse/foo.parse.json': result(1),
      'methods/parse/bar.parse.json': result(1),
      'schemas/object/deep/nested.json': result(1),
      'methods/parse/notes.txt': 'ignored',
    });

    assert.deepEqual(listResults(dir), [
      'methods/parse/bar.parse.json',
      'methods/parse/foo.parse.json',
      'root.json',
      'schemas/object/deep/nested.json',
    ]);
  });

  test('returns an empty array for a missing directory', (t) => {
    assert.deepEqual(listResults(path.join(tmpDir(t), 'missing')), []);
  });
});

describe('copyResults', () => {
  test('copies the source directory with its folder structure', (t) => {
    const dir = tmpDir(t);
    const source = path.join(dir, 'source');
    const dest = path.join(dir, 'dest');
    writeFiles(source, { 'methods/parse/foo.parse.json': result(1) });

    copyResults(source, dest);

    assert.deepEqual(listResults(dest), ['methods/parse/foo.parse.json']);
  });

  test('removes files left in the destination by a previous copy', (t) => {
    const dir = tmpDir(t);
    const source = path.join(dir, 'source');
    const dest = path.join(dir, 'dest');
    writeFiles(source, { 'new.json': result(1) });
    writeFiles(dest, { 'stale.json': result(1) });

    copyResults(source, dest);

    assert.deepEqual(listResults(dest), ['new.json']);
  });

  test('creates an empty destination when the source does not exist', (t) => {
    const dir = tmpDir(t);
    const dest = path.join(dir, 'dest');

    copyResults(path.join(dir, 'missing'), dest);

    assert.ok(fs.existsSync(dest));
    assert.deepEqual(listResults(dest), []);
  });
});
