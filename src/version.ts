import * as semver from 'semver';
import { ChangeType, DependencyChange, DependencyType, Ecosystem } from './types';

/**
 * Clean a version string by removing common prefixes (^, ~, =, etc.)
 */
export function cleanVersion(version: string): string {
  // Remove common version prefixes
  return version.replace(/^[\^~=<>!]+/, '').trim();
}

/**
 * Determine the type of version change between two versions
 */
export function determineChangeType(oldVersion: string, newVersion: string): ChangeType {
  const cleanOld = cleanVersion(oldVersion);
  const cleanNew = cleanVersion(newVersion);

  // Try to coerce to semver
  const semverOld = semver.coerce(cleanOld);
  const semverNew = semver.coerce(cleanNew);

  if (!semverOld || !semverNew) {
    // Can't parse as semver, just check if they're different
    return cleanOld !== cleanNew ? 'other' : 'other';
  }

  // Check for prerelease
  if (semver.prerelease(cleanNew)) {
    return 'prerelease';
  }

  const diff = semver.diff(semverOld, semverNew);

  if (!diff) {
    return 'other';
  }

  if (diff.includes('major')) {
    return 'major';
  }
  if (diff.includes('minor')) {
    return 'minor';
  }
  if (diff.includes('patch')) {
    return 'patch';
  }
  if (diff.includes('prerelease') || diff.includes('pre')) {
    return 'prerelease';
  }

  return 'other';
}

/**
 * Compare two sets of dependencies and return the changes
 */
export function compareVersions(
  oldDeps: Map<string, string>,
  newDeps: Map<string, string>,
  ecosystem: Ecosystem,
  file: string,
  dependencyType: DependencyType
): DependencyChange[] {
  const changes: DependencyChange[] = [];

  // Check for updates and removals
  for (const [name, oldVersion] of oldDeps) {
    const newVersion = newDeps.get(name);

    if (!newVersion) {
      // Dependency was removed
      changes.push({
        name,
        ecosystem,
        file,
        oldVersion,
        newVersion: null,
        changeType: 'removed',
        dependencyType,
      });
    } else if (cleanVersion(oldVersion) !== cleanVersion(newVersion)) {
      // Version changed
      const changeType = determineChangeType(oldVersion, newVersion);
      changes.push({
        name,
        ecosystem,
        file,
        oldVersion,
        newVersion,
        changeType,
        dependencyType,
      });
    }
  }

  // Check for additions
  for (const [name, newVersion] of newDeps) {
    if (!oldDeps.has(name)) {
      changes.push({
        name,
        ecosystem,
        file,
        oldVersion: null,
        newVersion,
        changeType: 'added',
        dependencyType,
      });
    }
  }

  return changes;
}
