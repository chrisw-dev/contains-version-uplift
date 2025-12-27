import { determineChangeType, compareVersions, cleanVersion } from '../src/version';

describe('Version Utils', () => {
  describe('cleanVersion', () => {
    it('should remove common prefixes', () => {
      expect(cleanVersion('^1.0.0')).toBe('1.0.0');
      expect(cleanVersion('~1.0.0')).toBe('1.0.0');
      expect(cleanVersion('>=1.0.0')).toBe('1.0.0');
      expect(cleanVersion('=1.0.0')).toBe('1.0.0');
      expect(cleanVersion('1.0.0')).toBe('1.0.0');
    });
  });

  describe('determineChangeType', () => {
    it('should detect major version changes', () => {
      expect(determineChangeType('1.0.0', '2.0.0')).toBe('major');
      expect(determineChangeType('^1.0.0', '^2.0.0')).toBe('major');
    });

    it('should detect minor version changes', () => {
      expect(determineChangeType('1.0.0', '1.1.0')).toBe('minor');
      expect(determineChangeType('1.2.3', '1.3.0')).toBe('minor');
    });

    it('should detect patch version changes', () => {
      expect(determineChangeType('1.0.0', '1.0.1')).toBe('patch');
      expect(determineChangeType('1.2.3', '1.2.4')).toBe('patch');
    });

    it('should detect prerelease versions', () => {
      expect(determineChangeType('1.0.0', '1.0.1-beta.1')).toBe('prerelease');
      expect(determineChangeType('1.0.0', '2.0.0-alpha.1')).toBe('prerelease');
    });

    it('should handle invalid versions', () => {
      expect(determineChangeType('not-a-version', 'also-not')).toBe('other');
    });
  });

  describe('compareVersions', () => {
    it('should detect added dependencies', () => {
      const oldDeps = new Map<string, string>();
      const newDeps = new Map([['lodash', '4.17.21']]);

      const changes = compareVersions(oldDeps, newDeps, 'node', 'package.json', 'production');

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('added');
      expect(changes[0].name).toBe('lodash');
      expect(changes[0].oldVersion).toBeNull();
      expect(changes[0].newVersion).toBe('4.17.21');
    });

    it('should detect removed dependencies', () => {
      const oldDeps = new Map([['lodash', '4.17.21']]);
      const newDeps = new Map<string, string>();

      const changes = compareVersions(oldDeps, newDeps, 'node', 'package.json', 'production');

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('removed');
      expect(changes[0].name).toBe('lodash');
      expect(changes[0].oldVersion).toBe('4.17.21');
      expect(changes[0].newVersion).toBeNull();
    });

    it('should detect version changes', () => {
      const oldDeps = new Map([['lodash', '4.17.20']]);
      const newDeps = new Map([['lodash', '4.17.21']]);

      const changes = compareVersions(oldDeps, newDeps, 'node', 'package.json', 'production');

      expect(changes).toHaveLength(1);
      expect(changes[0].changeType).toBe('patch');
      expect(changes[0].oldVersion).toBe('4.17.20');
      expect(changes[0].newVersion).toBe('4.17.21');
    });

    it('should not report unchanged dependencies', () => {
      const oldDeps = new Map([['lodash', '4.17.21']]);
      const newDeps = new Map([['lodash', '4.17.21']]);

      const changes = compareVersions(oldDeps, newDeps, 'node', 'package.json', 'production');

      expect(changes).toHaveLength(0);
    });

    it('should handle prefix changes as no change', () => {
      const oldDeps = new Map([['lodash', '^4.17.21']]);
      const newDeps = new Map([['lodash', '~4.17.21']]);

      const changes = compareVersions(oldDeps, newDeps, 'node', 'package.json', 'production');

      expect(changes).toHaveLength(0);
    });
  });
});
