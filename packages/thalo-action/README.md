# @rejot-dev/thalo-action

A GitHub Action that automatically updates Thalo syntheses when entries change, similar to how
Changesets automates version bumps.

## How It Works

1. **On push to main**: The action runs `runActualize()` to detect which syntheses have pending
   changes
2. **For each pending synthesis**: Runs your command (typically an LLM call) with the synthesis data
3. **Your command**: Handles updating the files with the generated synthesis content
4. **Creates/updates PR**: All changes are committed to a branch and a PR is opened for review

## Usage

### Prerequisites

Your workflow must set up Node.js and install dependencies before using this action. The action
requires the `@rejot-dev/thalo` package to be available.

### Basic Example

```yaml
name: Thalo Synthesis

on:
  push:
    branches: [main]
    paths:
      - "**/*.thalo"
      - "**/*.md"

jobs:
  synthesize:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0 # Need full history for git-based change tracking

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "24"

      - name: Install dependencies
        run: npm install

      - name: Update Syntheses
        uses: rejot-dev/thalo/packages/thalo-action@main
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          command: node scripts/synthesize.js
        env:
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

### Inputs

| Input               | Required | Default                   | Description                                                                        |
| ------------------- | -------- | ------------------------- | ---------------------------------------------------------------------------------- |
| `github-token`      | Yes      | -                         | GitHub token for creating PRs                                                      |
| `command`           | Yes      | -                         | Command to run for each synthesis. Receives synthesis JSON on stdin.               |
| `syntheses`         | No       | `""`                      | Specific synthesis link IDs to process (comma-separated). If empty, processes all. |
| `working-directory` | No       | `.`                       | Working directory for thalo files                                                  |
| `branch-name`       | No       | `thalo/update-syntheses`  | Branch name for the PR                                                             |
| `pr-title`          | No       | `Update Thalo Syntheses`  | Title for the PR                                                                   |
| `commit-message`    | No       | `chore: update syntheses` | Commit message                                                                     |
| `base-branch`       | No       | `main`                    | Base branch for the PR                                                             |

### Outputs

| Output                | Description                           |
| --------------------- | ------------------------------------- |
| `pull-request-url`    | URL of the created or updated PR      |
| `pull-request-number` | Number of the created or updated PR   |
| `syntheses-updated`   | Number of syntheses that were updated |

## Writing Your Command

Your command receives synthesis JSON on stdin and is responsible for:

1. Calling an LLM to generate the synthesis content
2. Updating the markdown file with the output
3. Adding the `actualize-synthesis` entry with the checkpoint

### Synthesis Input Format

```json
{
  "file": "docs/reading-list.md",
  "title": "Reading List Summary",
  "linkId": "reading-summary",
  "sources": ["reference where status = \"read\""],
  "prompt": "Create a summary of the books...",
  "entries": [
    {
      "file": "entries.thalo",
      "timestamp": "2026-01-07T10:18Z",
      "entity": "reference",
      "title": "Clean Code",
      "linkId": "clean-code",
      "tags": ["books", "programming"],
      "rawText": "2026-01-07T10:18Z create reference \"Clean Code\"..."
    }
  ],
  "currentCheckpoint": "git:abc123def456",
  "lastCheckpoint": "git:previous123"
}
```

## How Checkpoints Work

The action uses git-based change tracking:

1. Each synthesis has an `actualize-synthesis` entry with a `checkpoint` field
2. The checkpoint contains a git commit hash (e.g., `git:abc123`)
3. On subsequent runs, only entries modified since that commit are included
4. After your command runs, it should add a new `actualize-synthesis` entry with the current
   checkpoint

## License

MIT
