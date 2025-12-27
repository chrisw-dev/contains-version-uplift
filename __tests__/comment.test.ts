import { formatChangesAsMarkdown } from '../src/comment';
import { DependencyChange } from '../src/types';

describe('Comment Formatting', () => {
  describe('formatChangesAsMarkdown', () => {
    it('should format no changes message', () => {
      const result = formatChangesAsMarkdown([]);

      expect(result).toContain('<!-- dependency-version-uplift-check -->');
      expect(result).toContain('No Dependency Version Changes');
    });

    it('should format single ecosystem changes', () => {
      const changes: DependencyChange[] = [
        {
          name: 'lodash',
          ecosystem: 'node',
          file: 'package.json',
          oldVersion: '4.17.20',
          newVersion: '4.17.21',
          changeType: 'patch',
          dependencyType: 'production',
        },
      ];

      const result = formatChangesAsMarkdown(changes);

      expect(result).toContain('<!-- dependency-version-uplift-check -->');
      expect(result).toContain('Dependency Version Changes');
      expect(result).toContain('Node.js / npm');
      expect(result).toContain('lodash');
      expect(result).toContain('4.17.20');
      expect(result).toContain('4.17.21');
      expect(result).toContain('Patch');
    });

    it('should format multiple ecosystem changes', () => {
      const changes: DependencyChange[] = [
        {
          name: 'lodash',
          ecosystem: 'node',
          file: 'package.json',
          oldVersion: '4.17.20',
          newVersion: '4.17.21',
          changeType: 'patch',
          dependencyType: 'production',
        },
        {
          name: 'requests',
          ecosystem: 'python',
          file: 'requirements.txt',
          oldVersion: '2.30.0',
          newVersion: '2.31.0',
          changeType: 'minor',
          dependencyType: 'production',
        },
      ];

      const result = formatChangesAsMarkdown(changes);

      expect(result).toContain('Node.js / npm');
      expect(result).toContain('Python');
      expect(result).toContain('lodash');
      expect(result).toContain('requests');
    });

    it('should format added and removed dependencies', () => {
      const changes: DependencyChange[] = [
        {
          name: 'new-package',
          ecosystem: 'node',
          file: 'package.json',
          oldVersion: null,
          newVersion: '1.0.0',
          changeType: 'added',
          dependencyType: 'production',
        },
        {
          name: 'old-package',
          ecosystem: 'node',
          file: 'package.json',
          oldVersion: '1.0.0',
          newVersion: null,
          changeType: 'removed',
          dependencyType: 'production',
        },
      ];

      const result = formatChangesAsMarkdown(changes);

      expect(result).toContain('Added');
      expect(result).toContain('_new_');
      expect(result).toContain('_removed_');
    });

    it('should include summary section', () => {
      const changes: DependencyChange[] = [
        {
          name: 'major-pkg',
          ecosystem: 'node',
          file: 'package.json',
          oldVersion: '1.0.0',
          newVersion: '2.0.0',
          changeType: 'major',
          dependencyType: 'production',
        },
        {
          name: 'minor-pkg',
          ecosystem: 'node',
          file: 'package.json',
          oldVersion: '1.0.0',
          newVersion: '1.1.0',
          changeType: 'minor',
          dependencyType: 'production',
        },
      ];

      const result = formatChangesAsMarkdown(changes);

      expect(result).toContain('Summary');
      expect(result).toContain('1 major');
      expect(result).toContain('1 minor');
    });
  });
});
