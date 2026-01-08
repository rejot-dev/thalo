# thalo-cli

A command-line linter for thalo files. Runs diagnostics on `.thalo` and `.md` files containing thalo
syntax.

## Installation

```bash
# From the monorepo root
pnpm install
pnpm exec turbo run build --filter=@rejot-dev/thalo-cli

# Run directly
node apps/thalo-cli/dist/index.js --help
```

## Usage

```bash
thalo [options] [files or directories...]
```

### Basic Examples

```bash
# Check all files in a directory
thalo notes/

# Check specific files
thalo file.thalo journal.md

# Check current directory
thalo
```

## Options

| Option                | Description                                            |
| --------------------- | ------------------------------------------------------ |
| `-h, --help`          | Show help message                                      |
| `-v, --version`       | Show version number                                    |
| `-q, --quiet`         | Only show errors, suppress warnings and info           |
| `-f, --format <fmt>`  | Output format: `default`, `json`, `compact`, `github`  |
| `--no-color`          | Disable colored output                                 |
| `--severity <level>`  | Minimum severity to report: `error`, `warning`, `info` |
| `--max-warnings <n>`  | Exit with error if warnings exceed threshold           |
| `--rule <rule>=<sev>` | Set rule severity (can be repeated)                    |
| `--list-rules`        | List all available rules                               |
| `-w, --watch`         | Watch files for changes and re-run                     |

## Output Formats

### Default

Colored output with file location, severity, rule code, and message:

```
/path/to/file.md:1:1 ERROR [unknown-entity] Unknown entity type 'lore'.
/path/to/file.md:3:11 WARNING [unresolved-link] Unresolved link '^self'.
```

### JSON (`-f json`)

Structured JSON output for tooling integration:

```json
{
  "files": 11,
  "issues": 70,
  "errors": 54,
  "warnings": 16,
  "info": 0,
  "diagnostics": [
    {
      "file": "/path/to/file.md",
      "line": 1,
      "column": 1,
      "endLine": 9,
      "endColumn": 1,
      "severity": "error",
      "code": "unknown-entity",
      "message": "Unknown entity type 'lore'."
    }
  ]
}
```

### Compact (`-f compact`)

Minimal single-line format:

```
/path/to/file.md:1:1: E [unknown-entity] Unknown entity type 'lore'.
/path/to/file.md:3:11: W [unresolved-link] Unresolved link '^self'.
```

### GitHub Actions (`-f github`)

Workflow commands for GitHub Actions annotations:

```
::error file=/path/to/file.md,line=1,col=1,endLine=9,endColumn=1,title=unknown-entity::Unknown entity type 'lore'.
::warning file=/path/to/file.md,line=3,col=11,endLine=3,endColumn=17,title=unresolved-link::Unresolved link '^self'.
```

## Rules

List all available rules with `--list-rules`:

| Rule                       | Default | Description                      |
| -------------------------- | ------- | -------------------------------- |
| `unknown-entity`           | error   | Unknown entity type used         |
| `missing-required-field`   | error   | Required metadata field missing  |
| `unknown-field`            | warning | Unknown metadata field used      |
| `invalid-field-type`       | error   | Field value has wrong type       |
| `missing-required-section` | error   | Required section missing         |
| `unknown-section`          | warning | Unknown section used             |
| `unresolved-link`          | warning | Link reference not found         |
| `duplicate-link-id`        | error   | Same link ID used multiple times |

### Configuring Rules

Override rule severities with `--rule`:

```bash
# Disable a rule
thalo --rule unknown-entity=off notes/

# Change severity
thalo --rule unresolved-link=error notes/

# Multiple rules
thalo --rule unknown-entity=off --rule unknown-field=off notes/
```

Valid severities: `error`, `warning`, `info`, `off`

## CI Integration

### GitHub Actions

```yaml
- name: Lint thalo files
  run: thalo -f github notes/
```

### Warning Threshold

Fail if too many warnings:

```bash
thalo --max-warnings 10 notes/
```

### JSON Report

Generate a report file:

```bash
thalo -f json notes/ > thalo-report.json
```

## Watch Mode

Re-run on file changes:

```bash
thalo -w notes/
```

Press `Ctrl+C` to exit.

## Exit Codes

| Code | Meaning                               |
| ---- | ------------------------------------- |
| `0`  | No errors                             |
| `1`  | Errors found or max warnings exceeded |
| `2`  | Invalid arguments                     |
