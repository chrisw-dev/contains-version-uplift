import { DependencyFile, Ecosystem, ParsedDependencies } from '../types';
import { parsePackageJson, parsePackageLockJson, parseYarnLock, parsePnpmLock } from './node';
import { parseRequirementsTxt, parsePyprojectToml, parsePipfile, parsePoetryLock } from './python';
import { parseGoMod, parseGoSum } from './go';
import { parseGemfile, parseGemfileLock } from './ruby';
import { parsePomXml, parseBuildGradle } from './java';
import { parseCargoToml, parseCargoLock } from './rust';
import { parseCsproj, parsePackagesConfig } from './dotnet';

export interface DependencyFilePattern {
  ecosystem: Ecosystem;
  fileNames: string[];
  extensions: string[];
  parser: (content: string) => ParsedDependencies[];
}

/**
 * Patterns for identifying dependency files and their parsers
 */
export const DEPENDENCY_FILE_PATTERNS: DependencyFilePattern[] = [
  // Node.js
  {
    ecosystem: 'node',
    fileNames: ['package.json'],
    extensions: [],
    parser: parsePackageJson,
  },
  {
    ecosystem: 'node',
    fileNames: ['package-lock.json'],
    extensions: [],
    parser: parsePackageLockJson,
  },
  {
    ecosystem: 'node',
    fileNames: ['yarn.lock'],
    extensions: [],
    parser: parseYarnLock,
  },
  {
    ecosystem: 'node',
    fileNames: ['pnpm-lock.yaml'],
    extensions: [],
    parser: parsePnpmLock,
  },
  // Python
  {
    ecosystem: 'python',
    fileNames: ['requirements.txt', 'requirements-dev.txt', 'requirements-test.txt'],
    extensions: [],
    parser: parseRequirementsTxt,
  },
  {
    ecosystem: 'python',
    fileNames: ['pyproject.toml'],
    extensions: [],
    parser: parsePyprojectToml,
  },
  {
    ecosystem: 'python',
    fileNames: ['Pipfile'],
    extensions: [],
    parser: parsePipfile,
  },
  {
    ecosystem: 'python',
    fileNames: ['poetry.lock', 'Pipfile.lock'],
    extensions: [],
    parser: parsePoetryLock,
  },
  // Go
  {
    ecosystem: 'go',
    fileNames: ['go.mod'],
    extensions: [],
    parser: parseGoMod,
  },
  {
    ecosystem: 'go',
    fileNames: ['go.sum'],
    extensions: [],
    parser: parseGoSum,
  },
  // Ruby
  {
    ecosystem: 'ruby',
    fileNames: ['Gemfile'],
    extensions: [],
    parser: parseGemfile,
  },
  {
    ecosystem: 'ruby',
    fileNames: ['Gemfile.lock'],
    extensions: [],
    parser: parseGemfileLock,
  },
  // Java
  {
    ecosystem: 'java',
    fileNames: ['pom.xml'],
    extensions: [],
    parser: parsePomXml,
  },
  {
    ecosystem: 'java',
    fileNames: ['build.gradle', 'build.gradle.kts'],
    extensions: ['.gradle', '.gradle.kts'],
    parser: parseBuildGradle,
  },
  // Rust
  {
    ecosystem: 'rust',
    fileNames: ['Cargo.toml'],
    extensions: [],
    parser: parseCargoToml,
  },
  {
    ecosystem: 'rust',
    fileNames: ['Cargo.lock'],
    extensions: [],
    parser: parseCargoLock,
  },
  // .NET
  {
    ecosystem: 'dotnet',
    fileNames: ['packages.config'],
    extensions: ['.csproj', '.fsproj', '.vbproj'],
    parser: parseCsproj,
  },
];

/**
 * Get the parser for a given file path
 */
export function getParserForFile(filePath: string): DependencyFile | null {
  const fileName = filePath.split('/').pop() || '';

  for (const pattern of DEPENDENCY_FILE_PATTERNS) {
    // Check exact filename match
    if (pattern.fileNames.includes(fileName)) {
      return {
        path: filePath,
        ecosystem: pattern.ecosystem,
        parser: pattern.parser,
      };
    }

    // Check extension match
    for (const ext of pattern.extensions) {
      if (fileName.endsWith(ext)) {
        return {
          path: filePath,
          ecosystem: pattern.ecosystem,
          parser: pattern.parser,
        };
      }
    }
  }

  return null;
}

// Re-export all parsers
export * from './node';
export * from './python';
export * from './go';
export * from './ruby';
export * from './java';
export * from './rust';
export * from './dotnet';
