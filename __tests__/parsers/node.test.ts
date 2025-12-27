import { parsePackageJson, parsePackageLockJson, parseYarnLock, parsePnpmLock } from '../../src/parsers/node';
import { ParsedDependencies } from '../../src/types';

describe('Node.js Parsers', () => {
  describe('parsePackageJson', () => {
    it('should parse dependencies correctly', () => {
      const content = JSON.stringify({
        dependencies: {
          lodash: '^4.17.21',
          express: '~4.18.0',
        },
        devDependencies: {
          jest: '^29.0.0',
          typescript: '~5.0.0',
        },
      });

      const result = parsePackageJson(content);

      expect(result).toHaveLength(2);
      
      const prodDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'production');
      expect(prodDeps?.dependencies.get('lodash')).toBe('^4.17.21');
      expect(prodDeps?.dependencies.get('express')).toBe('~4.18.0');

      const devDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'development');
      expect(devDeps?.dependencies.get('jest')).toBe('^29.0.0');
      expect(devDeps?.dependencies.get('typescript')).toBe('~5.0.0');
    });

    it('should handle optional and peer dependencies', () => {
      const content = JSON.stringify({
        optionalDependencies: {
          fsevents: '^2.3.0',
        },
        peerDependencies: {
          react: '>=16.0.0',
        },
      });

      const result = parsePackageJson(content);

      expect(result).toHaveLength(2);
      expect(result.find((r: ParsedDependencies) => r.dependencyType === 'optional')).toBeDefined();
      expect(result.find((r: ParsedDependencies) => r.dependencyType === 'peer')).toBeDefined();
    });

    it('should return empty array for invalid JSON', () => {
      const result = parsePackageJson('not valid json');
      expect(result).toEqual([]);
    });

    it('should return empty array for package.json without dependencies', () => {
      const content = JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
      });

      const result = parsePackageJson(content);
      expect(result).toEqual([]);
    });
  });

  describe('parsePackageLockJson', () => {
    it('should parse lockfile v3 format', () => {
      const content = JSON.stringify({
        lockfileVersion: 3,
        packages: {
          '': { name: 'test' },
          'node_modules/lodash': { version: '4.17.21' },
          'node_modules/jest': { version: '29.7.0', dev: true },
        },
      });

      const result = parsePackageLockJson(content);

      expect(result).toHaveLength(2);
      
      const prodDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'production');
      expect(prodDeps?.dependencies.get('lodash')).toBe('4.17.21');

      const devDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'development');
      expect(devDeps?.dependencies.get('jest')).toBe('29.7.0');
    });

    it('should parse lockfile v2 format', () => {
      const content = JSON.stringify({
        lockfileVersion: 2,
        dependencies: {
          lodash: { version: '4.17.21' },
          jest: { version: '29.7.0', dev: true },
        },
      });

      const result = parsePackageLockJson(content);

      expect(result).toHaveLength(2);
    });
  });

  describe('parseYarnLock', () => {
    it('should parse yarn.lock format', () => {
      const content = `
"@babel/core@^7.0.0":
  version "7.23.0"
  resolved "https://registry.yarnpkg.com/@babel/core/-/core-7.23.0.tgz"

lodash@^4.17.0:
  version "4.17.21"
  resolved "https://registry.yarnpkg.com/lodash/-/lodash-4.17.21.tgz"
`;

      const result = parseYarnLock(content);

      expect(result).toHaveLength(1);
      expect(result[0].dependencies.get('@babel/core')).toBe('7.23.0');
      expect(result[0].dependencies.get('lodash')).toBe('4.17.21');
    });
  });

  describe('parsePnpmLock', () => {
    it('should parse pnpm-lock.yaml with importers', () => {
      const content = `
lockfileVersion: '6.0'
importers:
  .:
    dependencies:
      lodash:
        version: 4.17.21
    devDependencies:
      jest:
        version: 29.7.0
`;

      const result = parsePnpmLock(content);

      expect(result).toHaveLength(2);
      
      const prodDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'production');
      expect(prodDeps?.dependencies.get('lodash')).toBe('4.17.21');

      const devDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'development');
      expect(devDeps?.dependencies.get('jest')).toBe('29.7.0');
    });
  });
});
