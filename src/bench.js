import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { copyResults } from './files.js';

/**
 * Checks out a commit, runs the benchmarks and copies the results.
 *
 * @param {object} options
 * @param {string} options.sha The commit to check out.
 * @param {string} options.workspace The repository root.
 * @param {string} options.workingDirectory Where to run `install` and `run`, relative to the workspace.
 * @param {string} options.install The install command. Skipped if empty.
 * @param {string} options.run The benchmark command.
 * @param {string} options.source The benchmark output directory, relative to the workspace.
 * @param {string} options.dest Where to copy the results to.
 */
export function benchAt({
  sha,
  workspace,
  workingDirectory,
  install,
  run,
  source,
  dest,
}) {
  const cwd = path.resolve(workspace, workingDirectory);
  const sourceDir = path.resolve(workspace, source);

  exec(`git -c advice.detachedHead=false checkout --force ${sha}`, workspace);

  // Remove stale results so that they are not mixed into this run
  fs.rmSync(sourceDir, { recursive: true, force: true });

  if (install) {
    exec(install, cwd);
  }
  exec(run, cwd);
  copyResults(sourceDir, dest);
}

/**
 * @param {string} command
 * @param {string} cwd
 */
function exec(command, cwd) {
  console.log(`$ ${command}`);
  execSync(command, { cwd, stdio: 'inherit' });
}
