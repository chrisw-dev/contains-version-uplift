import * as github from '@actions/github';
import * as core from '@actions/core';
import { DependencyChange, Ecosystem } from './types';

const COMMENT_MARKER = '<!-- dependency-version-uplift-check -->';

/**
 * Maximum allowed length for package names and versions to prevent DoS
 */
const MAX_NAME_LENGTH = 256;
const MAX_VERSION_LENGTH = 128;

/**
 * Sanitize a string for safe inclusion in Markdown
 * Prevents markdown injection, XSS, and excessive length
 */
function sanitizeForMarkdown(input: string, maxLength: number): string {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Truncate to max length
  let sanitized = input.slice(0, maxLength);
  
  // Remove null bytes and control characters (except newline/tab)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  
  // Escape characters that could be used for markdown injection
  // Escape backticks (prevents code block injection)
  sanitized = sanitized.replace(/`/g, '\\`');
  
  // Escape pipe characters (prevents table manipulation)
  sanitized = sanitized.replace(/\|/g, '\\|');
  
  // Escape square brackets and parentheses (prevents link injection)
  sanitized = sanitized.replace(/\[/g, '\\[');
  sanitized = sanitized.replace(/\]/g, '\\]');
  
  // Remove HTML tags to prevent XSS (GitHub sanitizes, but defense in depth)
  sanitized = sanitized.replace(/<[^>]*>/g, '');
  
  // Escape HTML entities
  sanitized = sanitized.replace(/&/g, '&amp;');
  sanitized = sanitized.replace(/</g, '&lt;');
  sanitized = sanitized.replace(/>/g, '&gt;');
  
  return sanitized;
}

/**
 * Format changes as a Markdown comment
 */
export function formatChangesAsMarkdown(changes: DependencyChange[]): string {
  let md = `${COMMENT_MARKER}\n`;

  if (changes.length === 0) {
    md += '## ✅ No Dependency Version Changes\n\n';
    md += 'No dependency version uplifts were detected in this pull request.\n';
    return md;
  }

  md += '## 📦 Dependency Version Changes\n\n';
  md += `This pull request contains **${changes.length}** dependency version change${changes.length === 1 ? '' : 's'}.\n\n`;

  // Group by ecosystem
  const byEcosystem = groupByEcosystem(changes);

  for (const [ecosystem, deps] of Object.entries(byEcosystem)) {
    md += `### ${getEcosystemEmoji(ecosystem as Ecosystem)} ${getEcosystemDisplayName(ecosystem as Ecosystem)}\n\n`;
    md += '| Package | Previous | New | Change |\n';
    md += '|---------|----------|-----|--------|\n';

    // Sort by change type (major first, then minor, then patch, then others)
    const sorted = deps.sort((a, b) => {
      const order = { major: 0, minor: 1, patch: 2, prerelease: 3, added: 4, removed: 5, other: 6 };
      return (order[a.changeType] ?? 99) - (order[b.changeType] ?? 99);
    });

    for (const dep of sorted) {
      const emoji = getChangeTypeEmoji(dep.changeType);
      const safeName = sanitizeForMarkdown(dep.name, MAX_NAME_LENGTH);
      const oldVer = dep.oldVersion ? sanitizeForMarkdown(dep.oldVersion, MAX_VERSION_LENGTH) : '_new_';
      const newVer = dep.newVersion ? sanitizeForMarkdown(dep.newVersion, MAX_VERSION_LENGTH) : '_removed_';
      const changeLabel = getChangeTypeLabel(dep.changeType);
      
      md += `| \`${safeName}\` | ${oldVer} | ${newVer} | ${emoji} ${changeLabel} |\n`;
    }
    md += '\n';
  }

  // Add summary by change type
  md += '### Summary\n\n';
  const summary = summarizeChanges(changes);
  const summaryParts: string[] = [];
  
  if (summary.major > 0) summaryParts.push(`🔴 ${summary.major} major`);
  if (summary.minor > 0) summaryParts.push(`🟡 ${summary.minor} minor`);
  if (summary.patch > 0) summaryParts.push(`🟢 ${summary.patch} patch`);
  if (summary.prerelease > 0) summaryParts.push(`🟣 ${summary.prerelease} prerelease`);
  if (summary.added > 0) summaryParts.push(`➕ ${summary.added} added`);
  if (summary.removed > 0) summaryParts.push(`➖ ${summary.removed} removed`);
  if (summary.other > 0) summaryParts.push(`⚪ ${summary.other} other`);

  md += summaryParts.join(' | ') + '\n';

  return md;
}

/**
 * Create or update a comment on the PR
 */
export async function createOrUpdateComment(
  token: string,
  changes: DependencyChange[],
  context: typeof github.context
): Promise<void> {
  const octokit = github.getOctokit(token);
  const { owner, repo } = context.repo;
  const issueNumber = context.payload.pull_request?.number;

  if (!issueNumber) {
    core.warning('No pull request number found, cannot post comment');
    return;
  }

  const body = formatChangesAsMarkdown(changes);

  try {
    // Find existing comment
    const { data: comments } = await octokit.rest.issues.listComments({
      owner,
      repo,
      issue_number: issueNumber,
      per_page: 100,
    });

    const existingComment = comments.find((comment) => comment.body?.includes(COMMENT_MARKER));

    if (existingComment) {
      // Update existing comment
      await octokit.rest.issues.updateComment({
        owner,
        repo,
        comment_id: existingComment.id,
        body,
      });
      core.info(`Updated existing comment #${existingComment.id}`);
    } else {
      // Create new comment
      const { data: newComment } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: issueNumber,
        body,
      });
      core.info(`Created new comment #${newComment.id}`);
    }
  } catch (error) {
    if (error instanceof Error) {
      core.warning(`Failed to post comment: ${error.message}`);
    }
  }
}

/**
 * Group changes by ecosystem
 */
function groupByEcosystem(changes: DependencyChange[]): Record<string, DependencyChange[]> {
  const grouped: Record<string, DependencyChange[]> = {};

  for (const change of changes) {
    if (!grouped[change.ecosystem]) {
      grouped[change.ecosystem] = [];
    }
    grouped[change.ecosystem].push(change);
  }

  return grouped;
}

/**
 * Get display name for ecosystem
 */
function getEcosystemDisplayName(ecosystem: Ecosystem): string {
  const names: Record<Ecosystem, string> = {
    node: 'Node.js / npm',
    python: 'Python',
    go: 'Go',
    ruby: 'Ruby',
    java: 'Java / Gradle / Maven',
    rust: 'Rust / Cargo',
    dotnet: '.NET / NuGet',
  };
  return names[ecosystem] || ecosystem;
}

/**
 * Get emoji for ecosystem
 */
function getEcosystemEmoji(ecosystem: Ecosystem): string {
  const emojis: Record<Ecosystem, string> = {
    node: '📦',
    python: '🐍',
    go: '🐹',
    ruby: '💎',
    java: '☕',
    rust: '🦀',
    dotnet: '🔷',
  };
  return emojis[ecosystem] || '📦';
}

/**
 * Get emoji for change type
 */
function getChangeTypeEmoji(changeType: string): string {
  const emojis: Record<string, string> = {
    major: '🔴',
    minor: '🟡',
    patch: '🟢',
    prerelease: '🟣',
    added: '➕',
    removed: '➖',
    other: '⚪',
  };
  return emojis[changeType] || '⚪';
}

/**
 * Get label for change type
 */
function getChangeTypeLabel(changeType: string): string {
  const labels: Record<string, string> = {
    major: 'Major',
    minor: 'Minor',
    patch: 'Patch',
    prerelease: 'Prerelease',
    added: 'Added',
    removed: 'Removed',
    other: 'Changed',
  };
  return labels[changeType] || 'Changed';
}

/**
 * Summarize changes by type
 */
function summarizeChanges(changes: DependencyChange[]): Record<string, number> {
  const summary: Record<string, number> = {
    major: 0,
    minor: 0,
    patch: 0,
    prerelease: 0,
    added: 0,
    removed: 0,
    other: 0,
  };

  for (const change of changes) {
    summary[change.changeType] = (summary[change.changeType] || 0) + 1;
  }

  return summary;
}
