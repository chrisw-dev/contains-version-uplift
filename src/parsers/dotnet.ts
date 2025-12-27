import { ParsedDependencies } from '../types';
import { parseString } from 'xml2js';

interface CsprojFile {
  Project?: {
    ItemGroup?: Array<{
      PackageReference?: Array<{
        $?: {
          Include?: string;
          Version?: string;
        };
      }>;
    }>;
  };
}

interface PackagesConfig {
  packages?: {
    package?: Array<{
      $?: {
        id?: string;
        version?: string;
      };
    }>;
  };
}

/**
 * Parse .csproj (and similar .NET project files) for dependencies
 */
export function parseCsproj(content: string): ParsedDependencies[] {
  const deps = new Map<string, string>();

  try {
    let parsed: CsprojFile | PackagesConfig | null = null;
    parseString(
      content,
      {
        async: false,
        // Security: Disable external entities to prevent XXE attacks
        explicitCharkey: false,
        trim: true,
        normalize: true,
        // Prevent entity expansion attacks
        strict: true,
      },
      (err: Error | null, result: CsprojFile | PackagesConfig) => {
        if (!err) {
          parsed = result;
        }
      }
    );

    if (!parsed) {
      return [];
    }

    // Try csproj format
    const project = (parsed as CsprojFile).Project;
    if (project?.ItemGroup) {
      for (const itemGroup of project.ItemGroup) {
        if (itemGroup.PackageReference) {
          for (const pkgRef of itemGroup.PackageReference) {
            const include = pkgRef.$?.Include;
            const version = pkgRef.$?.Version;
            if (include && version) {
              deps.set(include, version);
            }
          }
        }
      }
    }

    // Try packages.config format
    const packagesConfig = (parsed as PackagesConfig).packages;
    if (packagesConfig?.package) {
      for (const pkg of packagesConfig.package) {
        const id = pkg.$?.id;
        const version = pkg.$?.version;
        if (id && version) {
          deps.set(id, version);
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
 * Parse packages.config for dependencies (legacy .NET)
 */
export function parsePackagesConfig(content: string): ParsedDependencies[] {
  return parseCsproj(content); // Same logic handles both formats
}
