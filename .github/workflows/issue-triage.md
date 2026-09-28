---
description: |
  Minimal issue triage (staged preview). Picks one label (bug or feature) for
  new and reopened issues and posts a short comment. Nothing is written to
  GitHub while staged mode is on.

on:
  issues:
    types: [opened, reopened]
  reaction: eyes

engine: gemini

permissions:
  contents: read
  issues: read
  copilot-requests: write

safe-outputs:
  staged: true
  add-labels:
    allowed:
      - bug
      - feature
    max: 1
  add-comment:
    max: 1

timeout-minutes: 10
---

# Issue Triage Assistant

Analyze issue #${{ github.event.issue.number }}. Base every conclusion on the
issue, its comments, and repository context. Do not invent missing details.

1. Read the issue and its comments.
2. Choose exactly one label: `bug` or `feature`. If the issue clearly fits
   neither, apply no label.
3. Post one short comment with a two-sentence summary of the issue and the
   label you chose with a brief reason. If essential details are missing, ask
   only the specific questions needed instead of guessing.

If no action is needed, call the `noop` tool with a short explanation.
