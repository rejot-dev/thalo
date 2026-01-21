### Commit

Use `specs/COMMIT.md` for the full commit conventions.

Create a concise conventional commit message and description for the current changes.

## Steps

1. Take into account the current changes in Git.
1. Present the commit message, and (optional, concise) description to the user
1. Ask: "If this looks good, say 'yes'. If you'd like to adjust the message or description, let me
   know what to change."
1. Iterate on feedback until the user is satisfied
1. Execute the commits in order using `git add` (with specific files/patches as needed) and
   `git commit`
1. After the commit is created, run `git log --oneline -n [number]` to show the final result

## Rules

### General

- DO NOT run destructive commands, INCLUDING BUT NOT LIMITED TO: `git reset`, `git clean`.
- DO NOT push
- ALWAYS keep tests, types, and docs together with the actual code that is being changed.
- Each line of the commit message should be less than 72 characters.

### Commit Structure

- Use conventional commits: `type(scope): description`
- Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `perf`, `style`, `ci`, `build`
- Scopes are package based, commits can have multiple scopes.

### File Splitting

- Use `git add -p` when a single file contains multiple independent changes
- Only split when changes are truly independent
- When in doubt, keep related changes together

## Pre-commit

When you try to commit, `lefthook` will run. All errors should be fixed before committing. Note that
when `lefthook` fails on formatting, the files will automatically be formatted by `prettier`, and
can thus by re-committed immediately (no need to take action, besides `git add`ing the files again).
