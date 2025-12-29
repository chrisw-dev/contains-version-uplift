import { ParsedDependencies } from '../types';
import * as yaml from 'js-yaml';
import * as core from '@actions/core';

/**
 * Safe YAML load options to prevent code execution and limit parsing
 * Uses JSON schema which only allows strings, numbers, booleans, null, arrays, objects
 * This prevents custom tags and JavaScript code execution
 */
const SAFE_YAML_OPTIONS: yaml.LoadOptions = {
  schema: yaml.JSON_SCHEMA,
  json: true,
};

interface PackageJsonDeps {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

/**
 * Maximum allowed JSON nesting depth
 */
const MAX_JSON_DEPTH = 20;

/**
 * Check if JSON content exceeds safe nesting depth
 * This prevents stack overflow from deeply nested malicious input
 * Note: This is a heuristic check - brackets in strings may cause false positives,
 * but the actual JSON.parse will still catch malformed input
 */
function checkJsonDepth(content: string, maxDepth: number): boolean {
  let depth = 0;
  let inString = false;
  let escape = false;

  for (const char of content) {
    if (escape) {
      escape = false;
      continue;
    }

    if (char === '\\' && inString) {
      escape = true;
      continue;
    }

    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    if (char === '{' || char === '[') {
      depth++;
      if (depth > maxDepth) {
        return false;
      }
    } else if (char === '}' || char === ']') {
      depth--;
      // Negative depth indicates malformed input
      if (depth < 0) {
        return false;
      }
    }
  }
  return true;
}

/**
 * Parse package.json for dependencies
 */
export function parsePackageJson(content: string): ParsedDependencies[] {
  try {
    // Check for excessive nesting depth before parsing
    if (!checkJsonDepth(content, MAX_JSON_DEPTH)) {
      return [];
    }
    const pkg: PackageJsonDeps = JSON.parse(content);
    const results: ParsedDependencies[] = [];

    if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
      results.push({
        dependencies: new Map(Object.entries(pkg.dependencies)),
        dependencyType: 'production',
      });
    }

    if (pkg.devDependencies && Object.keys(pkg.devDependencies).length > 0) {
      results.push({
        dependencies: new Map(Object.entries(pkg.devDependencies)),
        dependencyType: 'development',
      });
    }

    if (pkg.optionalDependencies && Object.keys(pkg.optionalDependencies).length > 0) {
      results.push({
        dependencies: new Map(Object.entries(pkg.optionalDependencies)),
        dependencyType: 'optional',
      });
    }

    if (pkg.peerDependencies && Object.keys(pkg.peerDependencies).length > 0) {
      results.push({
        dependencies: new Map(Object.entries(pkg.peerDependencies)),
        dependencyType: 'peer',
      });
    }

    return results;
  } catch (error) {
    core.debug(
      `Failed to parse package.json: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

interface PackageLockV3 {
  packages?: Record<string, { version?: string; dev?: boolean }>;
  lockfileVersion?: number;
}

interface PackageLockV2 {
  dependencies?: Record<string, { version?: string; dev?: boolean }>;
  lockfileVersion?: number;
}

/**
 * Parse package-lock.json for dependencies
 */
export function parsePackageLockJson(content: string): ParsedDependencies[] {
  try {
    const lock: PackageLockV3 & PackageLockV2 = JSON.parse(content);
    const prodDeps = new Map<string, string>();
    const devDeps = new Map<string, string>();

    // V3 format (lockfileVersion 3)
    if (lock.packages) {
      for (const [path, info] of Object.entries(lock.packages)) {
        // Skip root package (empty path) and node_modules root
        if (path === '' || path === 'node_modules') continue;

        // Must be a node_modules path to be a dependency
        if (!path.startsWith('node_modules/')) continue;

        // Extract package name from path (e.g., "node_modules/@types/node" -> "@types/node")
        const name = path
          .replace(/^node_modules\//, '')
          .split('node_modules/')
          .pop();

        if (!name || !info.version) continue;

        if (info.dev) {
          devDeps.set(name, info.version);
        } else {
          prodDeps.set(name, info.version);
        }
      }
    }
    // V2 format (lockfileVersion 2)
    else if (lock.dependencies) {
      for (const [name, info] of Object.entries(lock.dependencies)) {
        if (!info.version) continue;

        if (info.dev) {
          devDeps.set(name, info.version);
        } else {
          prodDeps.set(name, info.version);
        }
      }
    }

    const results: ParsedDependencies[] = [];
    if (prodDeps.size > 0) {
      results.push({ dependencies: prodDeps, dependencyType: 'production' });
    }
    if (devDeps.size > 0) {
      results.push({ dependencies: devDeps, dependencyType: 'development' });
    }

    return results;
  } catch (error) {
    core.debug(
      `Failed to parse package-lock.json: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

/**
 * Parse yarn.lock for dependencies
 * Yarn lock format is a custom format, we'll use regex to parse it
 */
export function parseYarnLock(content: string): ParsedDependencies[] {
  try {
    const deps = new Map<string, string>();
    const lines = content.split('\n');

    let currentPackage: string | null = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Package header lines look like:
      // "@babel/core@^7.0.0":
      // or: lodash@^4.17.0:
      // or with quotes: "@babel/core@^7.0.0":
      if (line && !line.startsWith(' ') && !line.startsWith('#') && line.includes('@')) {
        // Extract package name - everything before the last @version
        const cleanLine = line.replace(/["':]/g, '').trim();
        // Find the last @ that's followed by a version-like string
        const lastAtIndex = cleanLine.lastIndexOf('@');
        if (lastAtIndex > 0) {
          currentPackage = cleanLine.substring(0, lastAtIndex);
          // Handle scoped packages like @babel/core@^7.0.0
          // If the name starts with @, we need to find the second @
          if (cleanLine.startsWith('@')) {
            const secondAtIndex = cleanLine.indexOf('@', 1);
            if (secondAtIndex > 0) {
              currentPackage = cleanLine.substring(0, secondAtIndex);
            }
          }
        }
      }

      // Version line looks like: "  version "7.23.0""
      if (currentPackage && line.trim().startsWith('version')) {
        const versionMatch = line.match(/version\s+"?([^"\s]+)"?/);
        if (versionMatch) {
          const version = versionMatch[1];
          if (!deps.has(currentPackage)) {
            deps.set(currentPackage, version);
          }
          currentPackage = null;
        }
      }
    }

    if (deps.size === 0) {
      return [];
    }

    // Yarn lock doesn't distinguish dev deps, so mark all as production
    return [{ dependencies: deps, dependencyType: 'production' }];
  } catch (error) {
    core.debug(
      `Failed to parse yarn.lock: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}

interface PnpmLockfile {
  packages?: Record<string, { version?: string; dev?: boolean }>;
  importers?: Record<
    string,
    {
      dependencies?: Record<string, { version: string }>;
      devDependencies?: Record<string, { version: string }>;
    }
  >;
}

/**
 * Parse pnpm-lock.yaml for dependencies
 */
export function parsePnpmLock(content: string): ParsedDependencies[] {
  try {
    const lock = yaml.load(content, SAFE_YAML_OPTIONS) as PnpmLockfile;
    const prodDeps = new Map<string, string>();
    const devDeps = new Map<string, string>();

    // Try importers first (pnpm v6+)
    if (lock.importers) {
      for (const importer of Object.values(lock.importers)) {
        if (importer.dependencies) {
          for (const [name, info] of Object.entries(importer.dependencies)) {
            // Version might be like "7.0.0" or "link:../package"
            const version = typeof info === 'string' ? info : info.version;
            if (version && !version.startsWith('link:')) {
              prodDeps.set(name, version.replace(/\(.+\)$/, '')); // Remove peer dep info
            }
          }
        }
        if (importer.devDependencies) {
          for (const [name, info] of Object.entries(importer.devDependencies)) {
            const version = typeof info === 'string' ? info : info.version;
            if (version && !version.startsWith('link:')) {
              devDeps.set(name, version.replace(/\(.+\)$/, ''));
            }
          }
        }
      }
    }

    // Fallback to packages (older format)
    if (prodDeps.size === 0 && devDeps.size === 0 && lock.packages) {
      for (const [path, info] of Object.entries(lock.packages)) {
        // Path format: /@babel/core@7.23.0
        const match = path.match(/\/?(@?[^@]+)@(.+)/);
        if (match && match[1] && match[2]) {
          const name = match[1].startsWith('/') ? match[1].slice(1) : match[1];
          const version = match[2];

          // Skip linked packages (local workspace packages)
          if (version.startsWith('link:')) continue;

          if (info.dev) {
            devDeps.set(name, version);
          } else {
            prodDeps.set(name, version);
          }
        }
      }
    }

    const results: ParsedDependencies[] = [];
    if (prodDeps.size > 0) {
      results.push({ dependencies: prodDeps, dependencyType: 'production' });
    }
    if (devDeps.size > 0) {
      results.push({ dependencies: devDeps, dependencyType: 'development' });
    }

    return results;
  } catch (error) {
    core.debug(
      `Failed to parse pnpm-lock.yaml: ${error instanceof Error ? error.message : String(error)}`
    );
    return [];
  }
}
