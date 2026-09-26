# Vitest Bench Compare

A GitHub Action that runs your [Vitest](https://vitest.dev) benchmarks on both the base branch and the pull request, and posts the comparison as a pull request comment.

Vitest 5 removed the `--outputJson` / `--compare` CLI flags. Benchmark results are now written from test code via `writeResult`. This action fills the gap: put your results in one folder, and it takes care of checking out both commits, running, collecting, comparing and commenting.

## Example comment

<img width="910" height="335" alt="image" src="https://github.com/user-attachments/assets/f79bee23-4af7-4104-8778-bea366158824" />

> ## ⏱️ Benchmark results
>
> current: `3f2a9c1` (base) / compare: `8b7e4d2` (pull request)
>
> | bench   | current ops/sec | compare ops/sec | diff      |
> | ------- | --------------: | --------------: | :-------- |
> | startup |           2,000 |           2,041 | ➖ +2.04% |
>
> ### methods/parse
>
> | bench     | current ops/sec | compare ops/sec | diff       |
> | --------- | --------------: | --------------: | :--------- |
> | foo.parse |       3,846,154 |       4,761,905 | 🚀 +23.81% |
> | bar.parse |       3,225,806 |       2,941,176 | 🐢 -8.82%  |
> | legacy    |       2,500,000 |               - | 🗑️ removed |
>
> ### schemas/object
>
> | bench  | current ops/sec | compare ops/sec | diff   |
> | ------ | --------------: | --------------: | :----- |
> | nested |               - |         833,333 | 🆕 new |
>
> Diff is based on mean latency. Changes within ±5% are treated as noise.

The comment is updated in place on every push instead of adding a new one.

## Usage

### 1. Write benchmark results into one folder

Every benchmark writes its result with `writeResult` into the same base folder (e.g. `benchmarks/`). Subfolders become table groups and file names become rows.

```ts
// src/methods/parse/parse.bench.test.ts
import { describe, test } from 'vitest';

describe('parse', () => {
  test('parsing performance [foo]', async ({ bench }) => {
    await bench(
      'parse',
      { writeResult: './benchmarks/methods/parse/foo.parse.json' },
      () => {
        parse(object(entries), { key: 'foo' });
      },
    ).run();
  });
});
```

| Result file                               | Group            | Row         |
| ----------------------------------------- | ---------------- | ----------- |
| `benchmarks/startup.json`                 | (no group)       | `startup`   |
| `benchmarks/methods/parse/foo.parse.json` | `methods/parse`  | `foo.parse` |
| `benchmarks/schemas/object/nested.json`   | `schemas/object` | `nested`    |

The benchmark file must exist on the base branch too. Otherwise, all results are reported as `🆕 new`.

### 2. Add the workflow

```yaml
name: Benchmark

on:
  pull_request:

permissions:
  contents: read

jobs:
  bench:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with:
          fetch-depth: 0
          persist-credentials: false

      - uses: pnpm/action-setup@ea17c68df8912ef543352723c149a84f56e3d413 # v6.1.0

      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version: 24
          cache: pnpm

      - uses: ouka-lab/vitest-bench-compare@54b9cc02550dbee71b66e3ee1333736d131cb491 # v1.0.1
        with:
          dir: ${{ runner.temp }}/bench
          source: benchmarks
          install: pnpm install --frozen-lockfile
          run: pnpm exec vitest bench --run
```

All actions are pinned to a full-length commit SHA, as recommended in [Security hardening for GitHub Actions](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions#using-third-party-actions). Tags can be moved, but commit SHAs cannot. Keep the version in the trailing comment so that tools like Dependabot can update them.

For a monorepo, set `working-directory` and point `source` at the package's output folder:

```yaml
- uses: ouka-lab/vitest-bench-compare@54b9cc02550dbee71b66e3ee1333736d131cb491 # v1.0.1
  with:
    dir: ${{ runner.temp }}/bench
    source: library/benchmarks
    install: pnpm install --frozen-lockfile
    run: pnpm exec vitest bench --run
    working-directory: library
```

### Dry run

To try the action without posting anything to the pull request, set `dry-run: true`. The comparison is printed to the Actions log (the output of the `Compare benchmarks` step) instead of being posted as a comment.

```yaml
- uses: ouka-lab/vitest-bench-compare@54b9cc02550dbee71b66e3ee1333736d131cb491 # v1.0.1
  with:
    dir: ${{ runner.temp }}/bench
    source: benchmarks
    install: pnpm install --frozen-lockfile
    run: pnpm exec vitest bench --run
    dry-run: true
```

In dry-run mode, the `pull-requests: write` permission is not needed, so the action also works on pull requests from forks.

example:

<img width="1074" height="419" alt="image" src="https://github.com/user-attachments/assets/617b6c24-7b82-424b-bd64-bb5b7b099f9b" />

## Inputs

| Name                | Required | Default               | Description                                                                                                    |
| ------------------- | :------: | --------------------- | -------------------------------------------------------------------------------------------------------------- |
| `dir`               |   yes    |                       | Directory to collect results in. `current/` (base branch) and `compare/` (pull request) are created inside it. |
| `source`            |   yes    |                       | Benchmark output directory to copy results from, relative to the workspace root.                               |
| `run`               |   yes    |                       | Command to run the benchmarks.                                                                                 |
| `install`           |    no    | `''`                  | Command to install dependencies after each checkout. Skipped if empty.                                         |
| `working-directory` |    no    | `.`                   | Directory to run `install` and `run` in, relative to the workspace root.                                       |
| `github-token`      |    no    | `${{ github.token }}` | Token used to post the pull request comment.                                                                   |
| `dry-run`           |    no    | `false`               | Print the comparison to the Actions log instead of posting it as a pull request comment.                       |

## How it works

1. Check out the base commit (`pull_request.base.sha`) → run `install` → run `run` → copy `source` to `<dir>/current/`
2. Check out the pull request commit (`pull_request.head.sha`) → run `install` → run `run` → copy `source` to `<dir>/compare/`
3. Find `**/*.json` in both folders and match them by relative path
4. Create or update the pull request comment (or print it to the log with `dry-run: true`)

`source` is removed before each run, so results of the base run never leak into the pull request run. The workspace is left on the pull request commit.

Both runs happen sequentially on the same runner to keep the conditions as close as possible. The diff is based on mean latency, and changes within ±5% are treated as noise.

## Requirements

- `pull_request` events only
- `actions/checkout` with `fetch-depth: 0`, so both commits are available
- Node.js 22 or later on `PATH` (e.g. via `actions/setup-node`)
- `pull-requests: write` permission (not needed with `dry-run: true`)

## Limitations

- **Pull requests from forks cannot be commented on.** On `pull_request` events from forks, `GITHUB_TOKEN` is read-only. Open the pull request from a branch in the same repository, or use `dry-run: true` to see the results in the Actions log.
- The action runs `install` and `run` from both commits, so only use it on repositories where you trust the pull request code.

## Development

```bash
npm test
```

No dependencies are required. See [CONTRIBUTING.md](./CONTRIBUTING.md) for details.

## License

[MIT](./LICENSE)
