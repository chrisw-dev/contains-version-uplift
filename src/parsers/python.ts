import { ParsedDependencies } from '../types';
import * as toml from 'toml';

/**
 * Maximum allowed nesting depth for TOML/JSON structures
 */
const MAX_NESTING_DEPTH = 20;

/**
 * Maximum number of dependencies to process per file
 */
const MAX_DEPENDENCIES = 5000;

/**
 * Check if content exceeds safe nesting depth
 */
function checkNestingDepth(content: string, maxDepth: number): boolean {
  let depth = 0;
  for (const char of content) {
    if (char === '{' || char === '[') {
      depth++;
      if (depth > maxDepth) {
        return false;
      }
    } else if (char === '}' || char === ']') {
      depth--;
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

/**
 * Parse requirements.txt for dependencies
 */
export function parseRequirementsTxt(content: string): ParsedDependencies[] {
  try {
    const deps = new Map<string, string>();
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines, comments, and options
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('-')) {
        continue;
      }

      // Skip URLs and file paths
      if (trimmed.includes('://') || trimmed.startsWith('.') || trimmed.startsWith('/')) {
        continue;
      }

      // Match package specifiers: package==1.0.0, package>=1.0.0, package~=1.0.0, etc.
      // Also handle extras: package[extra]==1.0.0
      const match = trimmed.match(/^([a-zA-Z0-9_-]+(?:\[[^\]]+\])?)\s*([=<>!~]+)\s*([^\s;#]+)/);
      if (match) {
        const name = match[1].replace(/\[.*\]/, '').toLowerCase(); // Remove extras
        const version = match[3];
        deps.set(name, version);
      } else {
        // Package without version specifier
        const nameMatch = trimmed.match(/^([a-zA-Z0-9_-]+)/);
        if (nameMatch) {
          deps.set(nameMatch[1].toLowerCase(), '*');
        }
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

interface PyprojectToml {
  project?: {
    dependencies?: string[];
    'optional-dependencies'?: Record<string, string[]>;
  };
  tool?: {
    poetry?: {
      dependencies?: Record<string, string | { version?: string }>;
      'dev-dependencies'?: Record<string, string | { version?: string }>;
      group?: Record<string, { dependencies?: Record<string, string | { version?: string }> }>;
    };
  };
}

/**
 * Parse pyproject.toml for dependencies (PEP 621 and Poetry)
 */
export function parsePyprojectToml(content: string): ParsedDependencies[] {
  try {
    const pyproject = safeTomlParse<PyprojectToml>(content);
    if (!pyproject) {
      return [];
    }
    const results: ParsedDependencies[] = [];
    let totalDeps = 0;

    // PEP 621 format
    if (pyproject.project?.dependencies) {
      const deps = new Map<string, string>();
      for (const dep of pyproject.project.dependencies) {
        if (totalDeps >= MAX_DEPENDENCIES) break;
        const match = dep.match(/^([a-zA-Z0-9_-]+)(?:\[.*\])?\s*([=<>!~]+)?\s*(.+)?$/);
        if (match) {
          const name = match[1].toLowerCase();
          const version = match[3] || '*';
          deps.set(name, version);
          totalDeps++;
        }
      }
      if (deps.size > 0) {
        results.push({ dependencies: deps, dependencyType: 'production' });
      }
    }

    // PEP 621 optional dependencies (treat as dev)
    if (pyproject.project?.['optional-dependencies']) {
      const devDeps = new Map<string, string>();
      for (const group of Object.values(pyproject.project['optional-dependencies'])) {
        for (const dep of group) {
          if (totalDeps >= MAX_DEPENDENCIES) break;
          const match = dep.match(/^([a-zA-Z0-9_-]+)(?:\[.*\])?\s*([=<>!~]+)?\s*(.+)?$/);
          if (match) {
            const name = match[1].toLowerCase();
            const version = match[3] || '*';
            devDeps.set(name, version);
            totalDeps++;
          }
        }
      }
      if (devDeps.size > 0) {
        results.push({ dependencies: devDeps, dependencyType: 'development' });
      }
    }

    // Poetry format
    if (pyproject.tool?.poetry) {
      const poetry = pyproject.tool.poetry;

      if (poetry.dependencies) {
        const deps = new Map<string, string>();
        for (const [name, value] of Object.entries(poetry.dependencies)) {
          if (name.toLowerCase() === 'python') continue; // Skip python version constraint
          const version = typeof value === 'string' ? value : value.version || '*';
          deps.set(name.toLowerCase(), version);
        }
        if (deps.size > 0) {
          results.push({ dependencies: deps, dependencyType: 'production' });
        }
      }

      // Dev dependencies (old Poetry format)
      if (poetry['dev-dependencies']) {
        const deps = new Map<string, string>();
        for (const [name, value] of Object.entries(poetry['dev-dependencies'])) {
          const version = typeof value === 'string' ? value : value.version || '*';
          deps.set(name.toLowerCase(), version);
        }
        if (deps.size > 0) {
          results.push({ dependencies: deps, dependencyType: 'development' });
        }
      }

      // Poetry groups (new format)
      if (poetry.group) {
        for (const [groupName, group] of Object.entries(poetry.group)) {
          if (group.dependencies) {
            const deps = new Map<string, string>();
            for (const [name, value] of Object.entries(group.dependencies)) {
              const version = typeof value === 'string' ? value : value.version || '*';
              deps.set(name.toLowerCase(), version);
            }
            if (deps.size > 0) {
              const isDevGroup = ['dev', 'test', 'lint', 'typing'].includes(groupName);
              results.push({
                dependencies: deps,
                dependencyType: isDevGroup ? 'development' : 'production',
              });
            }
          }
        }
      }
    }

    return results;
  } catch {
    return [];
  }
}

interface Pipfile {
  packages?: Record<string, string | { version?: string }>;
  'dev-packages'?: Record<string, string | { version?: string }>;
}

/**
 * Parse Pipfile for dependencies
 */
export function parsePipfile(content: string): ParsedDependencies[] {
  try {
    const pipfile = safeTomlParse<Pipfile>(content);
    if (!pipfile) {
      return [];
    }
    const results: ParsedDependencies[] = [];

    if (pipfile.packages) {
      const deps = new Map<string, string>();
      for (const [name, value] of Object.entries(pipfile.packages)) {
        const version = typeof value === 'string' ? value : value.version || '*';
        deps.set(name.toLowerCase(), version);
      }
      if (deps.size > 0) {
        results.push({ dependencies: deps, dependencyType: 'production' });
      }
    }

    if (pipfile['dev-packages']) {
      const deps = new Map<string, string>();
      for (const [name, value] of Object.entries(pipfile['dev-packages'])) {
        const version = typeof value === 'string' ? value : value.version || '*';
        deps.set(name.toLowerCase(), version);
      }
      if (deps.size > 0) {
        results.push({ dependencies: deps, dependencyType: 'development' });
      }
    }

    return results;
  } catch {
    return [];
  }
}

interface PoetryLockPackage {
  name: string;
  version: string;
  category?: string;
}

interface PoetryLock {
  package?: PoetryLockPackage[];
}

/**
 * Parse poetry.lock for dependencies
 */
export function parsePoetryLock(content: string): ParsedDependencies[] {
  try {
    const lock = safeTomlParse<PoetryLock>(content);
    if (!lock) {
      return [];
    }
    const prodDeps = new Map<string, string>();
    const devDeps = new Map<string, string>();

    if (lock.package) {
      for (const pkg of lock.package) {
        if (pkg.category === 'dev') {
          devDeps.set(pkg.name.toLowerCase(), pkg.version);
        } else {
          prodDeps.set(pkg.name.toLowerCase(), pkg.version);
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
  } catch {
    return [];
  }
}
