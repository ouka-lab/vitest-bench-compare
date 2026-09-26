import fs from 'node:fs';
import path from 'node:path';
import { listResults } from './files.js';

/**
 * @typedef {object} BenchResult A result written by Vitest's `writeResult`.
 * @property {{ mean: number, p99: number, rme: number, samplesCount: number }} latency
 * @property {{ mean: number }} throughput
 */

/**
 * @typedef {object} Entry
 * @property {string} group The folder name (`''` for files directly under the root).
 * @property {string} name The file name without `.json`.
 * @property {BenchResult | undefined} current The base branch result.
 * @property {BenchResult | undefined} compare The pull request result.
 */

/**
 * Matches results in both directories by relative path.
 *
 * @param {string} currentDir The directory with the base branch results.
 * @param {string} compareDir The directory with the pull request results.
 * @returns {Entry[]} The entries sorted by relative path.
 */
export function compareResults(currentDir, compareDir) {
  const paths = [
    ...new Set([...listResults(currentDir), ...listResults(compareDir)]),
  ].sort();

  return paths.map((relativePath) => {
    const group = path.posix.dirname(relativePath);
    return {
      group: group === '.' ? '' : group,
      name: path.posix.basename(relativePath, '.json'),
      current: readResult(path.join(currentDir, relativePath)),
      compare: readResult(path.join(compareDir, relativePath)),
    };
  });
}

/**
 * Returns how much faster the pull request is, based on mean latency.
 *
 * @param {BenchResult} current The base branch result.
 * @param {BenchResult} compare The pull request result.
 * @returns {number} The difference in percent. Positive means faster.
 */
export function diffPercent(current, compare) {
  return (current.latency.mean / compare.latency.mean - 1) * 100;
}

/**
 * @param {string} file
 * @returns {BenchResult | undefined}
 */
function readResult(file) {
  return fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, 'utf8'))
    : undefined;
}
