import fs from 'node:fs';
import path from 'node:path';

/**
 * Lists all JSON files under a directory as sorted, `/`-separated relative paths.
 *
 * @param {string} dir The directory to search.
 * @returns {string[]} The relative paths. Empty if the directory does not exist.
 */
export function listResults(dir) {
  if (!fs.existsSync(dir)) {
    return [];
  }
  return fs
    .readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
    .map((entry) =>
      path
        .relative(dir, path.join(entry.parentPath, entry.name))
        .split(path.sep)
        .join('/'),
    )
    .sort();
}

/**
 * Replaces the destination directory with a copy of the source directory.
 *
 * @param {string} source The directory to copy from.
 * @param {string} dest The directory to copy to.
 */
export function copyResults(source, dest) {
  fs.rmSync(dest, { recursive: true, force: true });
  fs.mkdirSync(dest, { recursive: true });
  if (fs.existsSync(source)) {
    fs.cpSync(source, dest, { recursive: true });
  }
}
