import {
  parseRequirementsTxt,
  parsePyprojectToml,
  parsePipfile,
  parsePoetryLock,
} from '../../src/parsers/python';
import { ParsedDependencies } from '../../src/types';

describe('Python Parsers', () => {
  describe('parseRequirementsTxt', () => {
    it('should parse requirements with version specifiers', () => {
      const content = `
# This is a comment
requests==2.31.0
flask>=2.0.0
django~=4.2.0
numpy
-e git+https://github.com/user/repo.git#egg=mypackage
`;

      const result = parseRequirementsTxt(content);

      expect(result).toHaveLength(1);
      expect(result[0].dependencies.get('requests')).toBe('2.31.0');
      expect(result[0].dependencies.get('flask')).toBe('2.0.0');
      expect(result[0].dependencies.get('django')).toBe('4.2.0');
      expect(result[0].dependencies.get('numpy')).toBe('*');
    });

    it('should handle extras in package names', () => {
      const content = `
requests[security]==2.31.0
celery[redis,auth]>=5.0.0
`;

      const result = parseRequirementsTxt(content);

      expect(result[0].dependencies.get('requests')).toBe('2.31.0');
      expect(result[0].dependencies.get('celery')).toBe('5.0.0');
    });

    it('should skip URLs and file paths', () => {
      const content = `
https://example.com/package.whl
./local-package
/absolute/path/package
requests==2.31.0
`;

      const result = parseRequirementsTxt(content);

      expect(result[0].dependencies.size).toBe(1);
      expect(result[0].dependencies.get('requests')).toBe('2.31.0');
    });
  });

  describe('parsePyprojectToml', () => {
    it('should parse PEP 621 format', () => {
      const content = `
[project]
name = "mypackage"
dependencies = [
    "requests>=2.31.0",
    "flask~=2.0.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
]
`;

      const result = parsePyprojectToml(content);

      expect(result).toHaveLength(2);

      const prodDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'production');
      expect(prodDeps?.dependencies.get('requests')).toBe('2.31.0');

      const devDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'development');
      expect(devDeps?.dependencies.get('pytest')).toBe('7.0.0');
    });

    it('should parse Poetry format', () => {
      const content = `
[tool.poetry]
name = "mypackage"

[tool.poetry.dependencies]
python = "^3.9"
requests = "^2.31.0"
flask = { version = "^2.0.0" }

[tool.poetry.dev-dependencies]
pytest = "^7.0.0"
`;

      const result = parsePyprojectToml(content);

      expect(result).toHaveLength(2);

      const prodDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'production');
      expect(prodDeps?.dependencies.get('requests')).toBe('^2.31.0');
      expect(prodDeps?.dependencies.get('flask')).toBe('^2.0.0');
      // Python version constraint should be skipped
      expect(prodDeps?.dependencies.has('python')).toBe(false);

      const devDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'development');
      expect(devDeps?.dependencies.get('pytest')).toBe('^7.0.0');
    });

    it('should parse Poetry group format', () => {
      const content = `
[tool.poetry.dependencies]
requests = "^2.31.0"

[tool.poetry.group.dev.dependencies]
pytest = "^7.0.0"

[tool.poetry.group.test.dependencies]
coverage = "^7.0.0"
`;

      const result = parsePyprojectToml(content);

      expect(result.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('parsePipfile', () => {
    it('should parse Pipfile format', () => {
      const content = `
[packages]
requests = "==2.31.0"
flask = "*"

[dev-packages]
pytest = ">=7.0.0"
`;

      const result = parsePipfile(content);

      expect(result).toHaveLength(2);

      const prodDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'production');
      expect(prodDeps?.dependencies.get('requests')).toBe('==2.31.0');

      const devDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'development');
      expect(devDeps?.dependencies.get('pytest')).toBe('>=7.0.0');
    });
  });

  describe('parsePoetryLock', () => {
    it('should parse poetry.lock format', () => {
      const content = `
[[package]]
name = "requests"
version = "2.31.0"

[[package]]
name = "pytest"
version = "7.4.0"
category = "dev"
`;

      const result = parsePoetryLock(content);

      expect(result).toHaveLength(2);

      const prodDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'production');
      expect(prodDeps?.dependencies.get('requests')).toBe('2.31.0');

      const devDeps = result.find((r: ParsedDependencies) => r.dependencyType === 'development');
      expect(devDeps?.dependencies.get('pytest')).toBe('7.4.0');
    });
  });
});
