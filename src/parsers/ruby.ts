import { ParsedDependencies } from '../types';

/**
 * Parse Gemfile for dependencies
 */
export function parseGemfile(content: string): ParsedDependencies[] {
  try {
    const deps = new Map<string, string>();
    const devDeps = new Map<string, string>();
    const lines = content.split('\n');
    let inDevGroup = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#')) {
        continue;
      }

      // Check for group blocks
      if (trimmed.match(/^group\s+:(?:development|test)/)) {
        inDevGroup = true;
        continue;
      }
      if (trimmed === 'end') {
        inDevGroup = false;
        continue;
      }

      // Parse gem declarations
      // gem 'name', '~> 1.0'
      // gem 'name', '>= 1.0', '< 2.0'
      // gem 'name'
      const gemMatch = trimmed.match(/^gem\s+['"]([^'"]+)['"]\s*(?:,\s*['"]([^'"]+)['"])?/);
      if (gemMatch) {
        const name = gemMatch[1];
        const version = gemMatch[2] || '*';

        if (inDevGroup) {
          devDeps.set(name, version);
        } else {
          deps.set(name, version);
        }
      }
    }

    const results: ParsedDependencies[] = [];
    if (deps.size > 0) {
      results.push({ dependencies: deps, dependencyType: 'production' });
    }
    if (devDeps.size > 0) {
      results.push({ dependencies: devDeps, dependencyType: 'development' });
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Parse Gemfile.lock for dependencies
 */
export function parseGemfileLock(content: string): ParsedDependencies[] {
  try {
    const deps = new Map<string, string>();
    const lines = content.split('\n');
    let inSpecs = false;

    for (const line of lines) {
      // Check for specs section
      if (line.trim() === 'specs:') {
        inSpecs = true;
        continue;
      }

      // End of specs section (new section starts)
      if (inSpecs && line.match(/^[A-Z]/)) {
        inSpecs = false;
        continue;
      }

      if (inSpecs) {
        // Match gem with version: "    name (1.2.3)"
        const match = line.match(/^\s{4}([a-zA-Z0-9_-]+)\s+\(([^)]+)\)/);
        if (match) {
          const name = match[1];
          const version = match[2];
          deps.set(name, version);
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
