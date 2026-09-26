# Contributing

Thanks for your interest in contributing to Vitest Bench Compare! This guide explains how to set up the project, make changes and get them merged.

## Reporting issues

Before opening an issue, please search the existing issues to avoid duplicates. When reporting a bug, include:

- The workflow snippet that uses the action
- The relevant part of the job log
- The folder structure of your benchmark results (e.g. the output of `find benchmarks -name '*.json'`)
- The Vitest and Node.js versions

## Development setup

Requirements:

- Node.js 22 or later
- Git

The action has no dependencies, so there is nothing to install.

```bash
git clone https://github.com/ysknsid25/vitest-bench-compare.git
cd vitest-bench-compare
npm test
```

## Project structure

```
├── action.yml       Composite action. Passes the inputs to src/main.js as environment variables
├── src/
│   ├── main.js      Entry point. Runs base → pull request → compare → comment
│   ├── bench.js     Checks out a commit, runs install and run, copies the results
│   ├── files.js     Finds result files and copies result folders
│   ├── compare.js   Matches results by relative path and calculates the diff
│   ├── render.js    Renders the Markdown comment
│   └── github.js    Creates or updates the pull request comment
└── test/            Tests for each module, plus an end-to-end test of main.js
```

Keep the logic in `src/` and keep `action.yml` a thin wrapper, so that everything can be tested locally.

## Making changes

1. Fork the repository and create a branch from `main`.
2. Make your changes.
3. Add or update tests (see below).
4. Run the tests and format the code.
5. Update `README.md` if you change inputs, behavior or the comment format.
6. Open a pull request.

### Tests

Every change must be covered by tests. Tests use the built-in [`node:test`](https://nodejs.org/api/test.html) runner.

```bash
npm test
```

- Unit tests live in `test/<module>.test.js`.
- `test/main.test.js` runs the whole flow against a throwaway Git repository created in a temporary directory. The GitHub API is replaced by a fake `fetch`, so no network access or token is required.
- Shared helpers are in `test/helpers.js`.

CI runs the tests on Node.js 22 and 24.

### Code style

- ES modules with explicit `.js` extensions in imports
- JSDoc on exported functions
- No runtime dependencies. The action runs directly from the repository without a build step, so please do not add any.

Format the code with [Prettier](https://prettier.io) before committing:

```bash
npx prettier --write .
```

### Trying the action in a real workflow

Push your branch to your fork and reference it from a workflow in another repository:

```yaml
- uses: <your-name>/vitest-bench-compare@<your-branch>
```

## Pull requests

- Keep each pull request focused on a single change.
- Describe what the change does and why it is needed.
- Include an example of the comment output if you change the comment format.

## Releasing

Releases are done by the maintainer:

1. Update `version` in `package.json`.
2. Create a GitHub release with a `vX.Y.Z` tag and publish it to the GitHub Marketplace.
3. Move the major version tag (e.g. `v1`) to the new release.

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
