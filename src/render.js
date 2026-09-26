import { diffPercent } from './compare.js';

export const MARKER = '<!-- vitest-bench-compare -->';
export const THRESHOLD = 5;

const HEADER = [
  '| bench | current ops/sec | compare ops/sec | diff |',
  '| --- | ---: | ---: | :--- |',
];

/**
 * Renders the comparison as a Markdown comment body.
 *
 * @param {import('./compare.js').Entry[]} entries The entries to render.
 * @param {{ currentSha: string, compareSha: string }} shas The compared commits.
 * @returns {string} The comment body.
 */
export function renderComment(entries, { currentSha, compareSha }) {
  const lines = [
    MARKER,
    '## ⏱️ Benchmark results',
    '',
    `current: \`${currentSha.slice(0, 7)}\` (base) / compare: \`${compareSha.slice(0, 7)}\` (pull request)`,
  ];

  if (entries.length === 0) {
    lines.push('', 'No benchmark results found.');
    return lines.join('\n');
  }

  // Entries are sorted by path, so files of the same folder are adjacent
  const groups = Map.groupBy(entries, (entry) => entry.group);
  for (const [group, groupEntries] of groups) {
    lines.push('');
    if (group) {
      lines.push(`### ${group}`, '');
    }
    lines.push(...HEADER, ...groupEntries.map(renderRow));
  }

  lines.push(
    '',
    `Diff is based on mean latency. Changes within ±${THRESHOLD}% are treated as noise.`,
  );
  return lines.join('\n');
}

/**
 * @param {import('./compare.js').Entry} entry
 * @returns {string}
 */
function renderRow({ name, current, compare }) {
  return `| ${name} | ${ops(current)} | ${ops(compare)} | ${renderDiff(current, compare)} |`;
}

/**
 * @param {import('./compare.js').BenchResult | undefined} current
 * @param {import('./compare.js').BenchResult | undefined} compare
 * @returns {string}
 */
function renderDiff(current, compare) {
  if (!current) {
    return '🆕 new';
  }
  if (!compare) {
    return '🗑️ removed';
  }
  const diff = diffPercent(current, compare);
  const sign = diff >= 0 ? '+' : '';
  const verdict = diff >= THRESHOLD ? '🚀' : diff <= -THRESHOLD ? '🐢' : '➖';
  return `${verdict} ${sign}${diff.toFixed(2)}%`;
}

/**
 * @param {import('./compare.js').BenchResult | undefined} result
 * @returns {string}
 */
function ops(result) {
  return result
    ? Math.round(result.throughput.mean).toLocaleString('en-US')
    : '-';
}
