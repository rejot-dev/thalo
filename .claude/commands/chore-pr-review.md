# Address PR Review Comments

Review and address unresolved coderabbit comments on the current PR.

## Steps

1. Run `pnpm pr-review` to get the list of unresolved coderabbit comments
2. For each issue, evaluate if it's valid and worth addressing:
   - **Valid**: The suggestion improves code quality, fixes a real bug, or addresses a legitimate
     concern
   - **Invalid/Skip**: The suggestion is overly defensive, doesn't apply to the codebase context, or
     conflicts with project conventions
3. For valid issues:
   - Make the necessary code changes
   - Keep track of what was done
4. After addressing all issues (or deciding to skip), provide a summary report
5. For each addressed issue, reply to the GitHub comment using `pnpm pr-reply "<url>" "<message>"`

## Evaluation Criteria

When deciding if an issue is valid, consider:

- Does it align with the project's coding style (see `.claude/commands/chore-deslop.md`)?
- Is the suggested fix overly defensive for internal/trusted code paths?
- Does it add unnecessary complexity?
- Is it a real bug or just a theoretical concern?
- Does the codebase already handle this elsewhere?

## Reply Format

When replying to comments, use a concise format:

- **Fixed**: `"Fixed: <brief description of what was done>"`
- **Won't fix**: `"Won't fix: <brief reason why it's not applicable>"`
- **Partial fix**: `"Partially addressed: <what was done and what wasn't>"`

## Example Workflow

```
# 1. Review issues
pnpm pr-review

# 2. Fix valid issues in the code

# 3. Reply to each comment
pnpm pr-reply "https://github.com/.../pull/5#discussion_r123" "Fixed: Added try/catch with fallback rendering"
pnpm pr-reply "https://github.com/.../pull/5#discussion_r456" "Won't fix: Error is already handled by parent component"
```

## Rules

- DO consider if the issue is already handled elsewhere in the codebase
- DO reply to ALL comments, even if just to explain why it won't be fixed

## Summary Report Format

After processing all issues, provide a summary like:

```
## PR Review Summary

### Fixed (X issues)
- [file:line] Title - Brief description of fix

### Won't Fix (Y issues)
- [file:line] Title - Reason

### Skipped (Z issues)
- [file:line] Title - Reason (e.g., outdated, already fixed)
```
