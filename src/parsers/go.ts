import { ParsedDependencies } from '../types';

/**
 * Parse go.mod for dependencies
 */
export function parseGoMod(content: string): ParsedDependencies[] {
  try {
    const deps = new Map<string, string>();
    const lines = content.split('\n');
    let inRequireBlock = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('//')) {
        continue;
      }

      // Check for require block start/end
      if (trimmed === 'require (') {
        inRequireBlock = true;
        continue;
      }
      if (trimmed === ')') {
        inRequireBlock = false;
        continue;
      }

      // Parse require line (inside or outside block)
      let requireMatch;
      if (inRequireBlock) {
        // Inside block: module version
        requireMatch = trimmed.match(/^(\S+)\s+(v[\d.]+[\w.-]*)/);
      } else {
        // Single require: require module version
        requireMatch = trimmed.match(/^require\s+(\S+)\s+(v[\d.]+[\w.-]*)/);
      }

      if (requireMatch) {
        const module = requireMatch[1];
        const version = requireMatch[2];
        // Skip indirect dependencies (marked with // indirect comment)
        if (!line.includes('// indirect')) {
          deps.set(module, version);
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

/**
 * Parse go.sum for dependencies
 * go.sum contains checksums for modules, we can extract versions from it
 */
export function parseGoSum(content: string): ParsedDependencies[] {
  try {
    const deps = new Map<string, string>();
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Format: module version/go.mod hash
      // or: module version hash
      const match = trimmed.match(/^(\S+)\s+(v[\d.]+[\w.-]*)(?:\/go\.mod)?\s+/);
      if (match) {
        const module = match[1];
        const version = match[2];
        // Only keep the first version we see for each module
        if (!deps.has(module)) {
          deps.set(module, version);
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
