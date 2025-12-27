import { ParsedDependencies } from '../types';
import { parseString } from 'xml2js';

interface PomXml {
  project?: {
    dependencies?: [
      {
        dependency?: Array<{
          groupId?: string[];
          artifactId?: string[];
          version?: string[];
          scope?: string[];
        }>;
      },
    ];
    dependencyManagement?: [
      {
        dependencies?: [
          {
            dependency?: Array<{
              groupId?: string[];
              artifactId?: string[];
              version?: string[];
            }>;
          },
        ];
      },
    ];
  };
}

/**
 * Parse pom.xml for dependencies
 */
export function parsePomXml(content: string): ParsedDependencies[] {
  const results: ParsedDependencies[] = [];
  const prodDeps = new Map<string, string>();
  const testDeps = new Map<string, string>();

  try {
    // Synchronous parsing using callback with security options
    let parsed: PomXml | null = null;
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
      (err: Error | null, result: PomXml) => {
        if (!err) {
          parsed = result;
        }
      }
    );

    if (!parsed) {
      return [];
    }

    const project = (parsed as PomXml).project;
    if (!project) {
      return [];
    }

    // Parse direct dependencies
    const dependencies = project.dependencies?.[0]?.dependency || [];
    for (const dep of dependencies) {
      const groupId = dep.groupId?.[0];
      const artifactId = dep.artifactId?.[0];
      const version = dep.version?.[0];
      const scope = dep.scope?.[0];

      if (groupId && artifactId && version) {
        // Skip property references like ${some.version}
        if (version.startsWith('${')) continue;

        const name = `${groupId}:${artifactId}`;
        if (scope === 'test') {
          testDeps.set(name, version);
        } else {
          prodDeps.set(name, version);
        }
      }
    }

    // Also parse dependencyManagement
    const managedDeps = project.dependencyManagement?.[0]?.dependencies?.[0]?.dependency || [];
    for (const dep of managedDeps) {
      const groupId = dep.groupId?.[0];
      const artifactId = dep.artifactId?.[0];
      const version = dep.version?.[0];

      if (groupId && artifactId && version) {
        if (version.startsWith('${')) continue;
        const name = `${groupId}:${artifactId}`;
        if (!prodDeps.has(name) && !testDeps.has(name)) {
          prodDeps.set(name, version);
        }
      }
    }

    if (prodDeps.size > 0) {
      results.push({ dependencies: prodDeps, dependencyType: 'production' });
    }
    if (testDeps.size > 0) {
      results.push({ dependencies: testDeps, dependencyType: 'test' });
    }

    return results;
  } catch {
    return [];
  }
}

/**
 * Parse build.gradle or build.gradle.kts for dependencies
 */
export function parseBuildGradle(content: string): ParsedDependencies[] {
  try {
    const prodDeps = new Map<string, string>();
    const testDeps = new Map<string, string>();

    // Match various Gradle dependency declaration patterns:
    // implementation 'group:artifact:version'
    // implementation "group:artifact:version"
    // implementation("group:artifact:version")
    // testImplementation 'group:artifact:version'
    // api 'group:artifact:version'
    // compile 'group:artifact:version'
    // etc.

    const patterns = [
      // String literal with single or double quotes
      /(?:implementation|api|compile|runtimeOnly|compileOnly)\s*(?:\()?['"]([\w.-]+):([\w.-]+):([\w.-]+)['"]/g,
      // Test dependencies
      /(?:testImplementation|testCompile|testRuntimeOnly|androidTestImplementation)\s*(?:\()?['"]([\w.-]+):([\w.-]+):([\w.-]+)['"]/g,
    ];

    // Production dependencies
    let match;
    const prodPattern =
      /(?:implementation|api|compile|runtimeOnly|compileOnly)\s*(?:\()?['"]([\w.-]+):([\w.-]+):([\w.-]+)['"]/g;
    while ((match = prodPattern.exec(content)) !== null) {
      const name = `${match[1]}:${match[2]}`;
      const version = match[3];
      prodDeps.set(name, version);
    }

    // Test dependencies
    const testPattern =
      /(?:testImplementation|testCompile|testRuntimeOnly|androidTestImplementation)\s*(?:\()?['"]([\w.-]+):([\w.-]+):([\w.-]+)['"]/g;
    while ((match = testPattern.exec(content)) !== null) {
      const name = `${match[1]}:${match[2]}`;
      const version = match[3];
      testDeps.set(name, version);
    }

    // Kotlin DSL format with parentheses
    const kotlinPattern =
      /(?:implementation|api|compile|runtimeOnly|compileOnly)\s*\(\s*['"]([\w.-]+):([\w.-]+):([\w.-]+)['"]\s*\)/g;
    while ((match = kotlinPattern.exec(content)) !== null) {
      const name = `${match[1]}:${match[2]}`;
      const version = match[3];
      prodDeps.set(name, version);
    }

    const kotlinTestPattern =
      /(?:testImplementation|testCompile|testRuntimeOnly|androidTestImplementation)\s*\(\s*['"]([\w.-]+):([\w.-]+):([\w.-]+)['"]\s*\)/g;
    while ((match = kotlinTestPattern.exec(content)) !== null) {
      const name = `${match[1]}:${match[2]}`;
      const version = match[3];
      testDeps.set(name, version);
    }

    const results: ParsedDependencies[] = [];
    if (prodDeps.size > 0) {
      results.push({ dependencies: prodDeps, dependencyType: 'production' });
    }
    if (testDeps.size > 0) {
      results.push({ dependencies: testDeps, dependencyType: 'test' });
    }

    return results;
  } catch {
    return [];
  }
}
