import { ParsedDependencies } from '../types';
import * as toml from 'toml';

/**
 * Maximum allowed nesting depth for TOML structures
 */
const MAX_NESTING_DEPTH = 20;

/**
 * Check if content exceeds safe nesting depth
 * Note: This is a heuristic check for TOML - brackets in strings may cause false positives,
 * but the actual toml.parse will still catch malformed input
 */
function checkNestingDepth(content: string, maxDepth: number): boolean {
  let depth = 0;
  let inString = false;
  let stringChar = '';
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

    if ((char === '"' || char === "'") && !inString) {
      inString = true;
      stringChar = char;
      continue;
    }

    if (char === stringChar && inString) {
      inString = false;
      stringChar = '';
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
 * Safe TOML parse with depth checking
 */
function safeTomlParse<T>(content: string): T | null {
  if (!checkNestingDepth(content, MAX_NESTING_DEPTH)) {
    return null;
  }
  return toml.parse(content) as T;
}

interface CargoToml {
  dependencies?: Record<string, string | { version?: string }>;
  'dev-dependencies'?: Record<string, string | { version?: string }>;
  'build-dependencies'?: Record<string, string | { version?: string }>;
}

/**
 * Parse Cargo.toml for dependencies
 */
export function parseCargoToml(content: string): ParsedDependencies[] {
  try {
    const cargo = safeTomlParse<CargoToml>(content);
    if (!cargo) {
      return [];
    }
    const results: ParsedDependencies[] = [];

    if (cargo.dependencies) {
      const deps = new Map<string, string>();
      for (const [name, value] of Object.entries(cargo.dependencies)) {
        const version = typeof value === 'string' ? value : value.version || '*';
        deps.set(name, version);
      }
      if (deps.size > 0) {
        results.push({ dependencies: deps, dependencyType: 'production' });
      }
    }

    if (cargo['dev-dependencies']) {
      const deps = new Map<string, string>();
      for (const [name, value] of Object.entries(cargo['dev-dependencies'])) {
        const version = typeof value === 'string' ? value : value.version || '*';
        deps.set(name, version);
      }
      if (deps.size > 0) {
        results.push({ dependencies: deps, dependencyType: 'development' });
      }
    }

    if (cargo['build-dependencies']) {
      const deps = new Map<string, string>();
      for (const [name, value] of Object.entries(cargo['build-dependencies'])) {
        const version = typeof value === 'string' ? value : value.version || '*';
        deps.set(name, version);
      }
      if (deps.size > 0) {
        results.push({ dependencies: deps, dependencyType: 'build' });
      }
    }

    return results;
  } catch {
    return [];
  }
}

interface CargoLockPackage {
  name: string;
  version: string;
}

interface CargoLock {
  package?: CargoLockPackage[];
}

/**
 * Parse Cargo.lock for dependencies
 */
export function parseCargoLock(content: string): ParsedDependencies[] {
  try {
    const lock = safeTomlParse<CargoLock>(content);
    if (!lock) {
      return [];
    }
    const deps = new Map<string, string>();

    if (lock.package) {
      for (const pkg of lock.package) {
        deps.set(pkg.name, pkg.version);
      }
    }

    if (deps.size === 0) {
      return [];
    }

    return [{ dependencies: deps, dependencyType: 'production' }];
  } catch {
    return [];
  }
}
