import * as core from '@actions/core';
import * as exec from '@actions/exec';
import * as github from '@actions/github';
import { DependencyChange, ActionInputs, Ecosystem, VALID_ECOSYSTEMS } from './types';
import { getParserForFile, DEPENDENCY_FILE_PATTERNS } from './parsers';
import { compareVersions, determineChangeType } from './version';
import { createOrUpdateComment } from './comment';

/**
 * Get the list of changed files in the PR
 */
async function getChangedFiles(baseSha: string, headSha: string): Promise<string[]> {
  // Fetch the base commit to ensure we have it for diff
  try {
    await exec.exec('git', ['fetch', 'origin', baseSha, '--depth=1'], { silent: true });
  } catch {
    core.debug(`Could not fetch base SHA ${baseSha}, it may already be available`);
  }

  let output = '';
  await exec.exec('git', ['diff', '--name-only', baseSha, headSha], {
    listeners: {
      stdout: (data: Buffer) => {
        output += data.toString();
      },
    },
    silent: true,
  });

  return output
    .trim()
    .split('\n')
    .filter((f) => f.length > 0);
}

/**
 * Validate file path to prevent path traversal
 */
function isValidFilePath(filePath: string): boolean {
  // Prevent path traversal attacks
  if (filePath.includes('..') || filePath.startsWith('/') || filePath.includes('\0')) {
    return false;
  }
  // Ensure path doesn't try to access system files
  if (filePath.startsWith('/etc') || filePath.startsWith('/proc') || filePath.startsWith('/sys')) {
    return false;
  }
  return true;
}

/**
 * Get file content at a specific git ref
 */
async function getFileAtRef(filePath: string, ref: string): Promise<string | null> {
  // Validate file path
  if (!isValidFilePath(filePath)) {
    core.warning(`Skipping invalid file path: ${filePath}`);
    return null;
  }

  // Validate ref format (should be a valid git SHA)
  if (!/^[a-f0-9]{40}$/i.test(ref)) {
    core.warning(`Invalid git ref format: ${ref}`);
    return null;
  }

  try {
    let content = '';
    const exitCode = await exec.exec('git', ['show', `${ref}:${filePath}`], {
      listeners: {
        stdout: (data: Buffer) => {
          content += data.toString();
        },
      },
      silent: true,
      ignoreReturnCode: true,
    });

    if (exitCode !== 0) {
      return null;
    }
    
    // Limit file size to prevent memory issues (10MB max)
    if (content.length > 10 * 1024 * 1024) {
      core.warning(`File too large, skipping: ${filePath}`);
      return null;
    }
    
    return content;
  } catch {
    return null;
  }
}

/**
 * Check if a file is a dependency file we should analyze
 */
function isDependencyFile(filePath: string): boolean {
  const fileName = filePath.split('/').pop() || '';
  return DEPENDENCY_FILE_PATTERNS.some(
    (pattern) => pattern.fileNames.includes(fileName) || pattern.extensions.some((ext) => fileName.endsWith(ext))
  );
}

/**
 * Filter ecosystems based on user input
 */
function filterEcosystems(ecosystems: Ecosystem[] | 'all'): Ecosystem[] {
  if (ecosystems === 'all') {
    return [...VALID_ECOSYSTEMS];
  }
  return ecosystems;
}

/**
 * Analyze a single dependency file for version changes
 */
async function analyzeFile(
  filePath: string,
  baseSha: string,
  headSha: string,
  includeDevDependencies: boolean
): Promise<DependencyChange[]> {
  const parser = getParserForFile(filePath);
  if (!parser) {
    return [];
  }

  const oldContent = await getFileAtRef(filePath, baseSha);
  const newContent = await getFileAtRef(filePath, headSha);

  // File didn't exist before and doesn't exist now - shouldn't happen but handle it
  if (!oldContent && !newContent) {
    return [];
  }

  const changes: DependencyChange[] = [];

  // Parse old and new dependencies
  const oldDeps = oldContent ? parser.parser(oldContent) : [];
  const newDeps = newContent ? parser.parser(newContent) : [];

  // Flatten dependencies by type
  const oldByType = new Map<string, Map<string, string>>();
  const newByType = new Map<string, Map<string, string>>();

  for (const parsed of oldDeps) {
    if (!includeDevDependencies && parsed.dependencyType !== 'production') {
      continue;
    }
    const existing = oldByType.get(parsed.dependencyType) || new Map();
    for (const [name, version] of parsed.dependencies) {
      existing.set(name, version);
    }
    oldByType.set(parsed.dependencyType, existing);
  }

  for (const parsed of newDeps) {
    if (!includeDevDependencies && parsed.dependencyType !== 'production') {
      continue;
    }
    const existing = newByType.get(parsed.dependencyType) || new Map();
    for (const [name, version] of parsed.dependencies) {
      existing.set(name, version);
    }
    newByType.set(parsed.dependencyType, existing);
  }

  // Get all dependency types
  const allTypes = new Set([...oldByType.keys(), ...newByType.keys()]);

  for (const depType of allTypes) {
    const oldTypeDeps = oldByType.get(depType) || new Map();
    const newTypeDeps = newByType.get(depType) || new Map();

    const typeChanges = compareVersions(oldTypeDeps, newTypeDeps, parser.ecosystem, filePath, depType as any);
    changes.push(...typeChanges);
  }

  return changes;
}

/**
 * Validate ecosystem input
 */
function validateEcosystem(ecosystem: string): ecosystem is Ecosystem {
  return (VALID_ECOSYSTEMS as readonly string[]).includes(ecosystem);
}

/**
 * Parse action inputs
 */
function getInputs(): ActionInputs {
  const token = core.getInput('token') || process.env.GITHUB_TOKEN || '';
  
  // Mask the token so it doesn't appear in logs
  if (token) {
    core.setSecret(token);
  }
  
  const ecosystemsInput = core.getInput('ecosystems') || 'all';
  const commentOnPr = core.getBooleanInput('comment-on-pr');
  const includeDevDependencies = core.getBooleanInput('include-dev-dependencies');

  let ecosystems: Ecosystem[] | 'all';
  if (ecosystemsInput === 'all') {
    ecosystems = 'all';
  } else {
    const requestedEcosystems = ecosystemsInput.split(',').map((e) => e.trim().toLowerCase());
    const validEcosystems = requestedEcosystems.filter(validateEcosystem);
    
    if (validEcosystems.length === 0) {
      core.warning(`No valid ecosystems specified. Valid options: ${VALID_ECOSYSTEMS.join(', ')}. Using 'all' instead.`);
      ecosystems = 'all';
    } else if (validEcosystems.length < requestedEcosystems.length) {
      const invalid = requestedEcosystems.filter((e) => !validateEcosystem(e));
      core.warning(`Ignoring invalid ecosystems: ${invalid.join(', ')}`);
      ecosystems = validEcosystems as Ecosystem[];
    } else {
      ecosystems = validEcosystems as Ecosystem[];
    }
  }

  return {
    token,
    ecosystems,
    commentOnPr,
    includeDevDependencies,
  };
}

/**
 * Main action logic
 */
export async function run(): Promise<void> {
  try {
    const inputs = getInputs();
    const context = github.context;

    // Ensure we're in a PR context
    const pullRequest = context.payload.pull_request;
    if (!pullRequest) {
      core.warning('This action should be run on pull_request events. No PR context found.');
      core.setOutput('has-changes', false);
      core.setOutput('changes-json', '[]');
      core.setOutput('changes-count', 0);
      return;
    }

    const baseSha = pullRequest.base.sha;
    const headSha = pullRequest.head.sha;

    core.info(`Comparing ${baseSha.substring(0, 7)}...${headSha.substring(0, 7)}`);

    // Get changed files
    const changedFiles = await getChangedFiles(baseSha, headSha);
    core.info(`Found ${changedFiles.length} changed files`);

    // Filter to dependency files
    const dependencyFiles = changedFiles.filter(isDependencyFile);
    core.info(`Found ${dependencyFiles.length} dependency files to analyze`);

    if (dependencyFiles.length === 0) {
      core.info('No dependency files changed');
      core.setOutput('has-changes', false);
      core.setOutput('changes-json', '[]');
      core.setOutput('changes-count', 0);

      if (inputs.commentOnPr && inputs.token) {
        await createOrUpdateComment(inputs.token, [], context);
      }
      return;
    }

    // Analyze each dependency file
    const activeEcosystems = filterEcosystems(inputs.ecosystems);
    let allChanges: DependencyChange[] = [];

    for (const file of dependencyFiles) {
      core.debug(`Analyzing ${file}`);
      const changes = await analyzeFile(file, baseSha, headSha, inputs.includeDevDependencies);

      // Filter by active ecosystems
      const filteredChanges = changes.filter((c) => activeEcosystems.includes(c.ecosystem));
      allChanges.push(...filteredChanges);
    }

    // Deduplicate changes (same package might appear in multiple files)
    const uniqueChanges = deduplicateChanges(allChanges);

    core.info(`Detected ${uniqueChanges.length} dependency version changes`);

    // Set outputs
    core.setOutput('has-changes', uniqueChanges.length > 0);
    core.setOutput('changes-json', JSON.stringify(uniqueChanges));
    core.setOutput('changes-count', uniqueChanges.length);

    // Post comment if enabled
    if (inputs.commentOnPr && inputs.token) {
      await createOrUpdateComment(inputs.token, uniqueChanges, context);
    }

    // Log summary
    if (uniqueChanges.length > 0) {
      core.info('\n📦 Dependency Version Changes:');
      const byEcosystem = groupByEcosystem(uniqueChanges);
      for (const [ecosystem, deps] of Object.entries(byEcosystem)) {
        core.info(`\n  ${ecosystem}:`);
        for (const dep of deps) {
          const arrow = dep.changeType === 'added' ? '➕' : dep.changeType === 'removed' ? '➖' : '→';
          core.info(`    ${dep.name}: ${dep.oldVersion || 'N/A'} ${arrow} ${dep.newVersion || 'N/A'}`);
        }
      }
    }
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed('An unexpected error occurred');
    }
  }
}

/**
 * Deduplicate changes - prefer changes from manifest files over lock files
 */
function deduplicateChanges(changes: DependencyChange[]): DependencyChange[] {
  const seen = new Map<string, DependencyChange>();

  for (const change of changes) {
    const key = `${change.ecosystem}:${change.name}`;
    const existing = seen.get(key);

    if (!existing) {
      seen.set(key, change);
    } else {
      // Prefer manifest files over lock files
      const isLockFile = change.file.includes('lock') || change.file.includes('.lock');
      const existingIsLockFile = existing.file.includes('lock') || existing.file.includes('.lock');

      if (existingIsLockFile && !isLockFile) {
        seen.set(key, change);
      }
    }
  }

  return Array.from(seen.values());
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
