#!/usr/bin/env node

/**
 * Script to find unresolved coderabbit review comments in a PR.
 *
 * Usage:
 *   pnpm pr-review           # Auto-detect PR for current branch
 *   pnpm pr-review <number>  # Specify PR number
 */

import { execSync } from "node:child_process";

function getPrNumberForCurrentBranch(): string | null {
  try {
    const output = execSync("gh pr view --json number", {
      encoding: "utf-8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    const data = JSON.parse(output);
    return String(data.number);
  } catch {
    return null;
  }
}

interface CommentNode {
  author: { login: string };
  body: string;
  url: string;
}

interface ThreadNode {
  id: string;
  isResolved: boolean;
  isOutdated: boolean;
  path: string;
  line: number | null;
  comments: {
    nodes: CommentNode[];
  };
}

interface GraphQLResponse {
  data: {
    repository: {
      pullRequest: {
        reviewThreads: {
          nodes: ThreadNode[];
        };
      };
    };
  };
}

function extractTitle(body: string): string {
  // Extract the bold title after the severity indicator
  // Pattern: _⚠️ Potential issue_ | _🟠 Major_\n\n**Title here.**
  const match = body.match(/\*\*([^*]+)\*\*/);
  if (match) {
    return match[1].trim();
  }
  // Fallback: first line
  const firstLine = body.split("\n")[0];
  return firstLine.slice(0, 80) + (firstLine.length > 80 ? "..." : "");
}

function extractSeverity(body: string): string {
  if (body.includes("🔴 Critical")) {
    return "🔴 Critical";
  }
  if (body.includes("🟠 Major")) {
    return "🟠 Major";
  }
  if (body.includes("🟡 Minor")) {
    return "🟡 Minor";
  }
  if (body.includes("🟢")) {
    return "🟢 Low";
  }
  return "⚪ Unknown";
}

function extractDescription(body: string): string | null {
  // Extract the description text between the bold title and the first <details> block
  // Pattern: **Title.**\n\nDescription text here.\n\n<details>
  const match = body.match(
    /\*\*[^*]+\*\*\s*\n\n([\s\S]*?)(?=\n\n<details>|\n\n<!-- suggestion_start|\n\n<!-- fingerprinting)/,
  );
  if (match) {
    const desc = match[1].trim();
    // Skip if it's empty or just whitespace
    if (desc && desc.length > 0) {
      return desc;
    }
  }
  return null;
}

function extractAIPrompt(body: string): string | null {
  // Extract the "Prompt for AI Agents" section from the comment
  // Pattern: <details>\n<summary>🤖 Prompt for AI Agents</summary>\n\n```\n...\n```\n\n</details>
  const match = body.match(
    /<details>\s*<summary>🤖 Prompt for AI Agents<\/summary>\s*```([^`]+)```\s*<\/details>/s,
  );
  if (match) {
    return match[1].trim();
  }
  return null;
}

function run() {
  let prNumber: string | undefined = process.argv[2];

  // If no PR number provided, try to find one for the current branch
  if (!prNumber) {
    const detected = getPrNumberForCurrentBranch();
    if (detected) {
      prNumber = detected;
      console.log(`🔍 Auto-detected PR #${prNumber} for current branch\n`);
    } else {
      console.error("No PR found for current branch.");
      console.error("Usage: pnpm pr-review [pr-number]");
      console.error("Example: pnpm pr-review 5");
      process.exit(1);
    }
  }

  if (!/^\d+$/.test(prNumber)) {
    console.error("Invalid PR number. Usage: pnpm pr-review [pr-number]");
    process.exit(1);
  }

  // Get repository info from git remote
  let owner = "rejot-dev";
  let repo = "thalo";

  try {
    const remoteUrl = execSync("git config --get remote.origin.url", {
      encoding: "utf-8",
    }).trim();
    const match = remoteUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
    if (match) {
      owner = match[1];
      repo = match[2];
    }
  } catch {
    // Use defaults
  }

  const query = `
{
  repository(owner: "${owner}", name: "${repo}") {
    pullRequest(number: ${prNumber}) {
      reviewThreads(first: 100) {
        nodes {
          id
          isResolved
          isOutdated
          path
          line
          comments(first: 10) {
            nodes {
              author {
                login
              }
              body
              url
            }
          }
        }
      }
    }
  }
}`;

  let result: GraphQLResponse;
  try {
    const output = execSync(`gh api graphql -f query='${query}'`, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large responses
    });
    result = JSON.parse(output);
  } catch (_error) {
    console.error("Failed to fetch PR data. Make sure:");
    console.error("  1. gh CLI is installed and authenticated");
    console.error(`  2. PR #${prNumber} exists in ${owner}/${repo}`);
    process.exit(1);
  }

  const threads = result.data.repository.pullRequest.reviewThreads.nodes;

  // Filter for unresolved coderabbit threads
  const unresolvedCoderabbitThreads = threads.filter((thread) => {
    if (thread.isResolved) {
      return false;
    }
    const firstComment = thread.comments.nodes[0];
    return firstComment?.author?.login === "coderabbitai";
  });

  if (unresolvedCoderabbitThreads.length === 0) {
    console.log(`✅ No unresolved coderabbit comments in PR #${prNumber}`);
    process.exit(0);
  }

  console.log(
    `\n🐰 Found ${unresolvedCoderabbitThreads.length} unresolved coderabbit comment(s) in PR #${prNumber}:\n`,
  );

  for (const thread of unresolvedCoderabbitThreads) {
    const firstComment = thread.comments.nodes[0];
    const severity = extractSeverity(firstComment.body);
    const title = extractTitle(firstComment.body);
    const description = extractDescription(firstComment.body);
    const aiPrompt = extractAIPrompt(firstComment.body);
    const outdatedTag = thread.isOutdated ? " [OUTDATED]" : "";

    console.log(`${severity}${outdatedTag}`);
    console.log(`  📄 ${thread.path}:${thread.line ?? "?"}`);
    console.log(`  💬 ${title}`);
    if (description) {
      console.log(`  📝 ${description}`);
    }
    console.log(`  🔗 ${firstComment.url}`);
    if (aiPrompt) {
      console.log(`  🤖 AI Prompt:`);
      // Indent each line of the prompt
      for (const line of aiPrompt.split("\n")) {
        console.log(`     ${line}`);
      }
    }
    console.log();
  }

  // Summary by severity
  const severityCounts = new Map<string, number>();
  for (const thread of unresolvedCoderabbitThreads) {
    const severity = extractSeverity(thread.comments.nodes[0].body);
    severityCounts.set(severity, (severityCounts.get(severity) || 0) + 1);
  }

  console.log("📊 Summary:");
  for (const [severity, count] of severityCounts) {
    console.log(`   ${severity}: ${count}`);
  }
}

run();
