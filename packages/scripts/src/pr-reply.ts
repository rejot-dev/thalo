#!/usr/bin/env node

/**
 * Script to reply to a PR review comment.
 *
 * Usage:
 *   pnpm pr-reply <comment-url> <message>
 *   pnpm pr-reply "https://github.com/rejot-dev/thalo/pull/5#discussion_r123" "Fixed by adding error handling"
 */

import { execSync } from "node:child_process";

function run() {
  const commentUrl = process.argv[2];
  const message = process.argv[3];

  if (!commentUrl || !message) {
    console.error("Usage: pnpm pr-reply <comment-url> <message>");
    console.error(
      'Example: pnpm pr-reply "https://github.com/owner/repo/pull/5#discussion_r123" "Fixed"',
    );
    process.exit(1);
  }

  // Extract comment ID from URL
  // Format: https://github.com/owner/repo/pull/5#discussion_r2679632726
  const discussionMatch = commentUrl.match(/#discussion_r(\d+)/);
  if (!discussionMatch) {
    console.error("Invalid comment URL. Expected format: ...#discussion_r<id>");
    process.exit(1);
  }
  const commentId = discussionMatch[1];

  // Extract owner/repo from URL
  const repoMatch = commentUrl.match(/github\.com\/([^/]+)\/([^/]+)\/pull/);
  if (!repoMatch) {
    console.error("Could not extract repository from URL");
    process.exit(1);
  }
  const owner = repoMatch[1];
  const repo = repoMatch[2];

  // Use GitHub API to reply to the comment
  // We need to create a reply to a pull request review comment
  const apiUrl = `repos/${owner}/${repo}/pulls/comments/${commentId}/replies`;

  try {
    const result = execSync(`gh api ${apiUrl} -f body='${message.replace(/'/g, "'\\''")}'`, {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const response = JSON.parse(result);
    console.log(`✅ Reply posted: ${response.html_url}`);
  } catch (error) {
    console.error("Failed to post reply. Make sure:");
    console.error("  1. gh CLI is installed and authenticated");
    console.error("  2. The comment URL is valid");
    console.error("  3. You have permission to comment on the PR");
    if (error instanceof Error && "stderr" in error) {
      console.error("\nError:", (error as { stderr: string }).stderr);
    }
    process.exit(1);
  }
}

run();
