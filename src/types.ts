/**
 * Type definitions for dependency version changes
 */

export type ChangeType = 'added' | 'removed' | 'major' | 'minor' | 'patch' | 'prerelease' | 'other';

/**
 * All valid ecosystem identifiers - single source of truth
 */
export const VALID_ECOSYSTEMS = ['node', 'python', 'go', 'ruby', 'java', 'rust', 'dotnet'] as const;

export type Ecosystem = (typeof VALID_ECOSYSTEMS)[number];

export type DependencyType = 'production' | 'development' | 'optional' | 'peer' | 'build' | 'test';

export interface DependencyChange {
  /** Name of the dependency package */
  name: string;
  /** Ecosystem this dependency belongs to */
  ecosystem: Ecosystem;
  /** File where the change was detected */
  file: string;
  /** Previous version (null if newly added) */
  oldVersion: string | null;
  /** New version (null if removed) */
  newVersion: string | null;
  /** Type of version change */
  changeType: ChangeType;
  /** Type of dependency (production, dev, etc.) */
  dependencyType: DependencyType;
}

export interface ParsedDependencies {
  /** Map of dependency name to version string */
  dependencies: Map<string, string>;
  /** Type of these dependencies */
  dependencyType: DependencyType;
}

export interface DependencyFile {
  /** Path to the dependency file */
  path: string;
  /** Ecosystem this file belongs to */
  ecosystem: Ecosystem;
  /** Function to parse the file contents */
  parser: (content: string) => ParsedDependencies[];
}

export interface ActionInputs {
  token: string;
  ecosystems: Ecosystem[] | 'all';
  commentOnPr: boolean;
  includeDevDependencies: boolean;
}

export interface ActionOutputs {
  hasChanges: boolean;
  changesJson: string;
  changesCount: number;
}
